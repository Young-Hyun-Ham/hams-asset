import { matchesKoreanSearch } from "@/lib/korean-search";

export type StockInstrument = {
  symbol: string;
  name: string;
  market: "KRX" | "KOSDAQ" | "NYSE" | "NASDAQ" | "OTHER";
  currency: "KRW" | "USD";
  assetClass: "stock" | "etf";
  source: "KRX" | "NASDAQ";
};

type KrxRow = {
  short_code?: string;
  codeName?: string;
  marketEngName?: string;
};

type NasdaqRow = {
  symbol?: string;
  name?: string;
};

let catalogCache: { expiresAt: number; items: StockInstrument[] } | null = null;
let catalogRequest: Promise<StockInstrument[]> | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

function assetClass(name: string): "stock" | "etf" {
  return /\bETF\b|KODEX|TIGER|ACE|RISE|SOL|HANARO|ARIRANG|KOSEF|PLUS/i.test(name)
    ? "etf"
    : "stock";
}

async function fetchKrxStocks() {
  const body = new URLSearchParams({
    mktsel: "ALL",
    typeNo: "0",
    searchText: "",
    bld: "dbms/comm/finder/finder_stkisu",
  });
  const response = await fetch("https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://data.krx.co.kr/",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("KRX stock catalog request failed.");
  const result = await response.json() as { block1?: KrxRow[] };
  return (result.block1 ?? []).flatMap<StockInstrument>((row) => {
    const symbol = row.short_code?.trim();
    const name = row.codeName?.trim();
    if (!symbol || !name) return [];
    return [{
      symbol,
      name,
      market: row.marketEngName === "KOSDAQ" ? "KOSDAQ" : "KRX",
      currency: "KRW",
      assetClass: assetClass(name),
      source: "KRX",
    }];
  });
}

async function fetchUsExchange(exchange: "nasdaq" | "nyse" | "amex") {
  const response = await fetch(`https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true&exchange=${exchange}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.nasdaq.com/market-activity/stocks/screener",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Nasdaq stock catalog request failed.");
  const result = await response.json() as { data?: { rows?: NasdaqRow[] } };
  return (result.data?.rows ?? []).flatMap<StockInstrument>((row) => {
    const symbol = row.symbol?.trim();
    const name = row.name?.trim();
    if (!symbol || !name) return [];
    return [{
      symbol,
      name,
      market: exchange === "nasdaq" ? "NASDAQ" : exchange === "nyse" ? "NYSE" : "OTHER",
      currency: "USD",
      assetClass: assetClass(name),
      source: "NASDAQ",
    }];
  });
}

async function refreshCatalog() {
  const results = await Promise.allSettled([
    fetchKrxStocks(),
    fetchUsExchange("nasdaq"),
    fetchUsExchange("nyse"),
    fetchUsExchange("amex"),
  ]);
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!items.length) throw new Error("Stock catalog is unavailable.");
  const unique = new Map<string, StockInstrument>();
  for (const item of items) unique.set(`${item.currency}:${item.symbol}`, item);
  return [...unique.values()];
}

export async function getStockCatalog() {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.items;
  if (!catalogRequest) {
    catalogRequest = refreshCatalog()
      .then((items) => {
        catalogCache = { items, expiresAt: Date.now() + CACHE_TTL };
        return items;
      })
      .finally(() => {
        catalogRequest = null;
      });
  }
  return catalogRequest;
}

export async function searchStocks(query: string, page: number) {
  const catalog = await getStockCatalog();
  const keyword = query.trim();
  const matched = keyword
    ? catalog.filter((item) => item.symbol.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())
      || matchesKoreanSearch(item.name, keyword))
    : catalog;
  matched.sort((a, b) => {
    const aExact = a.symbol.toLocaleLowerCase() === keyword.toLocaleLowerCase() || a.name === keyword;
    const bExact = b.symbol.toLocaleLowerCase() === keyword.toLocaleLowerCase() || b.name === keyword;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return a.symbol.localeCompare(b.symbol, "en");
  });
  const pageSize = 50;
  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return { items: matched.slice(start, start + pageSize), page: currentPage, pageSize, total, totalPages };
}
