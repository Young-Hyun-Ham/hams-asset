export type HistoricalMetrics = {
  source: "YAHOO" | "UNAVAILABLE";
  periodDays: number;
  observationCount: number;
  trailingReturnPct: number | null;
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
  asOf: string | null;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
  };
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const historyCache = new Map<string, { expiresAt: number; value: HistoricalMetrics }>();

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unavailable(): HistoricalMetrics {
  return {
    source: "UNAVAILABLE",
    periodDays: 365,
    observationCount: 0,
    trailingReturnPct: null,
    annualizedVolatilityPct: null,
    maxDrawdownPct: null,
    asOf: null,
  };
}

function toYahooSymbol(symbol: string, market: "KRX" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "OTHER") {
  const normalized = symbol.trim().toUpperCase();
  if (market === "KRX") return `${normalized}.KS`;
  if (market === "KOSDAQ") return `${normalized}.KQ`;
  return normalized;
}

function calculateMetrics(prices: Array<{ timestamp: number; close: number }>): HistoricalMetrics {
  if (prices.length < 2) return unavailable();

  const first = prices[0].close;
  const last = prices.at(-1)!.close;
  const dailyReturns: number[] = [];

  let peak = first;
  let maxDrawdown = 0;

  for (let index = 0; index < prices.length; index += 1) {
    const close = prices[index].close;
    peak = Math.max(peak, close);
    maxDrawdown = Math.min(maxDrawdown, (close / peak - 1) * 100);

    if (index > 0) {
      dailyReturns.push(close / prices[index - 1].close - 1);
    }
  }

  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (dailyReturns.length - 1)
    : 0;

  return {
    source: "YAHOO",
    periodDays: 365,
    observationCount: prices.length,
    trailingReturnPct: round((last / first - 1) * 100),
    annualizedVolatilityPct: round(Math.sqrt(variance) * Math.sqrt(252) * 100),
    maxDrawdownPct: round(maxDrawdown),
    asOf: new Date(prices.at(-1)!.timestamp * 1000).toISOString(),
  };
}

export async function getHistoricalMetrics(
  symbol: string,
  market: "KRX" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "OTHER",
): Promise<HistoricalMetrics> {
  const yahooSymbol = toYahooSymbol(symbol, market);
  const cached = historyCache.get(yahooSymbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const endpoint = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
    endpoint.searchParams.set("range", "1y");
    endpoint.searchParams.set("interval", "1d");
    endpoint.searchParams.set("events", "history");

    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`Yahoo history response: ${response.status}`);

    const payload = (await response.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.adjclose?.[0]?.adjclose
      ?? result?.indicators?.quote?.[0]?.close
      ?? [];
    const prices = timestamps.flatMap((timestamp, index) => {
      const close = closes[index];
      return typeof close === "number" && Number.isFinite(close) && close > 0
        ? [{ timestamp, close }]
        : [];
    });
    const value = calculateMetrics(prices);
    historyCache.set(yahooSymbol, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch {
    const value = unavailable();
    historyCache.set(yahooSymbol, { expiresAt: Date.now() + 10 * 60 * 1000, value });
    return value;
  }
}
