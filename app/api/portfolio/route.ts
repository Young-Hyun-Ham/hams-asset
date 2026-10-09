import { getSsoUserFromRequest, unauthorizedSsoResponse } from "@hams-fam/sso-client";
import { decryptAssetJson } from "@/lib/asset-crypto";
import type { AssetProfile } from "@/lib/asset-spec";
import { getMarketQuote, getUsdKrwRate } from "@/lib/market-prices";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";

type PortfolioEntry = {
  id: string; ticker: string; name: string; category: string;
  assetType: "bank" | "brokerage"; value: number; cost: number;
  returnRate: number; dailyRate: number;
  quoteSource: "NAVER" | "NASDAQ" | "MANUAL";
  quoteRealTime: boolean; quotedAt: string | null;
};

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  try {
    const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
    await ensureAssetSchema();
    const rows = await getTursoClient().execute({
      sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_asset_profiles WHERE user_id = ? ORDER BY updated_at DESC",
      args: [user.id],
    });
    const profiles = rows.rows.map((row) => decryptAssetJson<AssetProfile>(String(row.encrypted_payload), String(row.wrapped_secret)));
    const usdKrw = await getUsdKrwRate();
    const tasks: Promise<PortfolioEntry>[] = [];

    for (const profile of profiles) {
      for (const account of profile.accounts) {
        if (profile.assetType === "bank") {
          for (const balance of account.balances) {
            const value = Number(balance.marketValue) * (balance.currency === "USD" ? usdKrw : 1);
            tasks.push(Promise.resolve({
              id: `${profile.id}:${account.id}:${balance.assetCode}`,
              ticker: balance.assetCode,
              name: account.displayName,
              category: `${profile.provider.name} · ${account.accountNumberMasked}`,
              assetType: "bank", value, cost: value, returnRate: 0, dailyRate: 0,
              quoteSource: "MANUAL", quoteRealTime: false, quotedAt: null,
            }));
          }
          continue;
        }
        for (const holding of account.holdings) {
          tasks.push((async () => {
            const quote = await getMarketQuote(holding, forceRefresh);
            const exchange = holding.currency === "USD" ? usdKrw : 1;
            const quantity = Number(holding.quantity);
            const value = quantity * quote.price * exchange;
            const cost = quantity * Number(holding.averagePrice) * exchange;
            return {
              id: holding.id, ticker: holding.symbol, name: holding.name,
              category: `${profile.provider.name} · ${holding.market}`,
              assetType: "brokerage" as const, value, cost,
              returnRate: cost > 0 ? ((value - cost) / cost) * 100 : 0,
              dailyRate: quote.changeRate, quoteSource: quote.source,
              quoteRealTime: quote.isRealTime, quotedAt: quote.quotedAt,
            };
          })());
        }
      }
    }

    const entries = await Promise.all(tasks);
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const cost = entries.reduce((sum, entry) => sum + entry.cost, 0);
    const assets = entries.map((entry) => ({ ...entry, weight: total > 0 ? (entry.value / total) * 100 : 0 }));
    return Response.json({
      total, gain: total - cost,
      returnRate: cost > 0 ? ((total - cost) / cost) * 100 : 0,
      assets,
      allocation: {
        brokerage: assets.filter((asset) => asset.assetType === "brokerage").reduce((sum, asset) => sum + asset.value, 0),
        bank: assets.filter((asset) => asset.assetType === "bank").reduce((sum, asset) => sum + asset.value, 0),
      },
      usdKrw, updatedAt: new Date().toISOString(), refreshAfterSeconds: 60,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Portfolio lookup failed:", error);
    return Response.json({ error: "포트폴리오를 불러오는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
