import type { AssetHolding } from "@/lib/asset-spec";

export type MarketQuote = {
  price: number;
  changeRate: number;
  quotedAt: string;
  isRealTime: boolean;
  source: "NAVER" | "NASDAQ" | "MANUAL";
};

const quoteCache = new Map<string, { expiresAt: number; quote: MarketQuote }>();
let usdKrwCache: { expiresAt: number; rate: number } | null = null;

function numeric(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchKoreanQuote(symbol: string): Promise<MarketQuote> {
  const response = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${encodeURIComponent(symbol)}`, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.naver.com/" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Korean quote lookup failed.");
  const result = await response.json() as {
    datas?: Array<{ closePriceRaw?: string; closePrice?: string; fluctuationsRatioRaw?: string; fluctuationsRatio?: string; localTradedAt?: string; marketStatus?: string }>;
  };
  const data = result.datas?.[0];
  const price = numeric(data?.closePriceRaw || data?.closePrice);
  if (!price) throw new Error("Korean quote is empty.");
  return {
    price,
    changeRate: numeric(data?.fluctuationsRatioRaw || data?.fluctuationsRatio),
    quotedAt: data?.localTradedAt || new Date().toISOString(),
    isRealTime: data?.marketStatus === "OPEN",
    source: "NAVER",
  };
}

async function fetchUsQuote(symbol: string): Promise<MarketQuote> {
  const response = await fetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0", Referer: "https://www.nasdaq.com/" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("US quote lookup failed.");
  const result = await response.json() as {
    data?: { primaryData?: { lastSalePrice?: string; percentageChange?: string; lastTradeTimestamp?: string; isRealTime?: boolean } };
  };
  const data = result.data?.primaryData;
  const price = numeric(data?.lastSalePrice);
  if (!price) throw new Error("US quote is empty.");
  return {
    price,
    changeRate: numeric(data?.percentageChange),
    quotedAt: data?.lastTradeTimestamp || new Date().toISOString(),
    isRealTime: data?.isRealTime === true,
    source: "NASDAQ",
  };
}

export async function getMarketQuote(holding: AssetHolding, forceRefresh = false): Promise<MarketQuote> {
  const key = `${holding.currency}:${holding.symbol}`;
  const cached = quoteCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.quote;
  try {
    const quote = holding.currency === "KRW"
      ? await fetchKoreanQuote(holding.symbol)
      : await fetchUsQuote(holding.symbol);
    quoteCache.set(key, { quote, expiresAt: Date.now() + 55_000 });
    return quote;
  } catch {
    return {
      price: numeric(holding.averagePrice),
      changeRate: 0,
      quotedAt: new Date().toISOString(),
      isRealTime: false,
      source: "MANUAL",
    };
  }
}

export async function getUsdKrwRate() {
  if (usdKrwCache && usdKrwCache.expiresAt > Date.now()) return usdKrwCache.rate;
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", { cache: "no-store" });
    const result = await response.json() as { rates?: { KRW?: number } };
    const rate = result.rates?.KRW;
    if (!rate || !Number.isFinite(rate)) throw new Error("Exchange rate is empty.");
    usdKrwCache = { rate, expiresAt: Date.now() + 60 * 60 * 1000 };
    return rate;
  } catch {
    return usdKrwCache?.rate ?? 1;
  }
}
