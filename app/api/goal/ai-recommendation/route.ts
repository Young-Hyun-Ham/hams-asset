import { getSsoAccessTokenFromRequest, getSsoServerUrl, getSsoUserFromRequest, unauthorizedSsoResponse } from "@hams-fam/sso-client";
import { randomUUID } from "node:crypto";
import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import type { AssetProfile } from "@/lib/asset-spec";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";
import type { AssetGoal } from "../route";

type AiResult = { headline: string; direction: string; actions: string[]; cautions: string[] };
type AiHistory = { recommendation: AiResult; assetNames: string[]; provider: string | null; model: string; createdAt: string };
const koreaDate = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  await ensureAssetSchema();
  const result = await getTursoClient().execute({
    sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_ai_goal_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [user.id],
  });
  const row = result.rows[0];
  if (!row) return Response.json({ history: null });
  const history = decryptAssetJson<AiHistory>(String(row.encrypted_payload), String(row.wrapped_secret));
  if (koreaDate(history.createdAt) !== koreaDate(new Date())) return Response.json({ history: null });
  return Response.json({ history }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  const accessToken = getSsoAccessTokenFromRequest(request);
  if (!accessToken) {
    return Response.json({ available: false, error: "SSO AI 접근 토큰이 없습니다. 다시 로그인해 주세요." }, { status: 401 });
  }
  try {
    const modelResponse = await fetch(new URL("/api/sso/ai/models", getSsoServerUrl()), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const modelPayload = await modelResponse.json().catch(() => null) as {
      ok?: boolean;
      provider?: string;
      defaultModel?: string | null;
      models?: Array<{ id?: string }>;
      error?: string;
      message?: string;
    } | null;
    if (!modelResponse.ok || !modelPayload?.ok) {
      const unavailable = modelResponse.status === 422 || modelPayload?.error === "ai_configuration_missing";
      return Response.json({ available: !unavailable, error: modelPayload?.message || (unavailable ? "회원정보에 AI API 키를 등록해 주세요." : "사용 가능한 AI 모델을 조회하지 못했습니다.") }, { status: modelResponse.status || 502 });
    }
    const models = (modelPayload.models ?? []).map((item) => item.id?.trim() ?? "").filter(Boolean);
    const model = modelPayload.defaultModel && models.includes(modelPayload.defaultModel)
      ? modelPayload.defaultModel
      : models[0];
    if (!model) return Response.json({ available: false, error: "사용 가능한 AI 모델이 없습니다." }, { status: 422 });

    await ensureAssetSchema();
    const [goalRows, assetRows] = await Promise.all([
      getTursoClient().execute({ sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_user_goals WHERE user_id = ?", args: [user.id] }),
      getTursoClient().execute({ sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_asset_profiles WHERE user_id = ?", args: [user.id] }),
    ]);
    const goalRow = goalRows.rows[0];
    if (!goalRow) return Response.json({ available: false, error: "목표 금액을 먼저 설정해 주세요." }, { status: 400 });
    const goal = decryptAssetJson<AssetGoal>(String(goalRow.encrypted_payload), String(goalRow.wrapped_secret));
    const profiles = assetRows.rows.map((row) => decryptAssetJson<AssetProfile>(String(row.encrypted_payload), String(row.wrapped_secret)));
    const assets: Record<string, string | number>[] = [];
    for (const profile of profiles) {
      for (const account of profile.accounts) {
        if (profile.assetType === "bank") {
          for (const balance of account.balances) assets.push({ type: "현금성 자산", provider: profile.provider.name, name: account.displayName, currency: balance.currency, amount: Number(balance.marketValue) });
        } else {
          for (const holding of account.holdings) assets.push({ type: holding.assetClass === "etf" ? "ETF" : "주식", provider: profile.provider.name, name: holding.name, symbol: holding.symbol, market: holding.market, currency: holding.currency, quantity: Number(holding.quantity), averagePrice: Number(holding.averagePrice) });
        }
      }
    }
    const aiResponse = await fetch(`${getSsoServerUrl()}/api/sso/ai/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        model,
        instructions: "당신은 개인 자산 목표 설계를 돕는 신중한 재무 코치입니다. 제공된 사실만 사용하고 수익을 보장하지 마세요. 구체적 종목의 매수·매도 지시 대신 목표 기간, 현금흐름, 분산, 비상금, 점검 주기를 중심으로 한국어로 답하세요.",
        prompt: JSON.stringify({ goal, registeredAssets: assets }),
        schemaName: "asset_goal_recommendation",
        schema: { type: "object", additionalProperties: false, properties: { headline: { type: "string" }, direction: { type: "string" }, actions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 }, cautions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 } }, required: ["headline", "direction", "actions", "cautions"] },
        maxOutputTokens: 1200,
        reasoningEffort: "low",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await aiResponse.json() as { ok?: boolean; output?: string; message?: string; error?: string };
    if (!aiResponse.ok || !payload.output) {
      const missing = aiResponse.status === 422 || payload.error === "ai_configuration_missing";
      return Response.json({ available: !missing, error: missing ? "회원정보에 AI API 키를 등록해 주세요." : payload.message || "AI 추천을 생성하지 못했습니다." }, { status: aiResponse.status });
    }
    const recommendation = JSON.parse(payload.output) as AiResult;
    const assetNames = Array.from(new Set(assets.flatMap((asset) => [String(asset.name ?? ""), String(asset.symbol ?? "")]).filter(Boolean)));
    const history: AiHistory = { recommendation, assetNames, provider: modelPayload.provider ?? null, model, createdAt: new Date().toISOString() };
    const encrypted = encryptAssetJson(history);
    await getTursoClient().execute({
      sql: "INSERT INTO encrypted_ai_goal_history (id, user_id, encrypted_payload, wrapped_secret, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [randomUUID(), user.id, encrypted.encryptedPayload, encrypted.wrappedSecret, history.createdAt],
    });
    return Response.json({ available: true, ...history }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("AI goal recommendation failed:", error);
    return Response.json({ available: true, error: "AI 목표 추천을 생성하는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
