import { randomUUID } from "node:crypto";

import {
  getSsoUserFromRequest,
  unauthorizedSsoResponse,
} from "@hams-fam/sso-client";

import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import {
  ASSET_SCHEMA_VERSION,
  cleanDecimal,
  maskedAccount,
  providerCode,
  type AssetHolding,
  type AssetProfile,
  type AssetProfileSummary,
  type AssetType,
} from "@/lib/asset-spec";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";
import { markAiGoalAssetChanged } from "@/lib/ai-goal-settings";

type CreateAssetInput = {
  assetType?: AssetType;
  providerName?: string;
  displayName?: string;
  accountLastFour?: string;
  accountType?: AssetProfile["accounts"][number]["accountType"];
  currency?: "KRW" | "USD";
  balance?: string;
  holdings?: Array<Partial<Omit<AssetHolding, "id">>>;
};

const accountTypes = new Set([
  "checking",
  "savings",
  "deposit",
  "securities",
  "isa",
  "pension",
  "cma",
]);
const markets = new Set(["KRX", "KOSDAQ", "NYSE", "NASDAQ", "OTHER"]);

function requiredText(value: unknown, label: string, maxLength = 80) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label}을(를) 입력해 주세요.`);
  if (text.length > maxLength) throw new Error(`${label}이(가) 너무 깁니다.`);
  return text;
}

function buildProfile(userId: string, input: CreateAssetInput): AssetProfile {
  const assetType = input.assetType;
  if (assetType !== "bank" && assetType !== "brokerage") {
    throw new Error("지원하지 않는 자산 유형입니다.");
  }

  const providerName = requiredText(
    input.providerName,
    assetType === "bank" ? "은행명" : "증권사명",
  );
  const displayName = requiredText(input.displayName, "계좌 별칭");
  const currency = input.currency === "USD" ? "USD" : "KRW";
  const allowedTypes =
    assetType === "bank"
      ? new Set(["checking", "savings", "deposit"])
      : new Set(["securities", "isa", "pension", "cma"]);
  const requestedType =
    typeof input.accountType === "string" && accountTypes.has(input.accountType)
      ? input.accountType
      : assetType === "bank"
        ? "checking"
        : "securities";
  const accountType = allowedTypes.has(requestedType)
    ? (requestedType as AssetProfile["accounts"][number]["accountType"])
    : assetType === "bank"
      ? "checking"
      : "securities";
  const now = new Date().toISOString();

  const holdings: AssetHolding[] =
    assetType === "brokerage"
      ? (input.holdings ?? []).slice(0, 100).map((item) => ({
          id: randomUUID(),
          symbol: requiredText(item.symbol, "종목 코드", 30).toUpperCase(),
          name: requiredText(item.name, "종목명"),
          market: markets.has(item.market ?? "") ? item.market! : "OTHER",
          assetClass: item.assetClass === "etf" ? "etf" : "stock",
          currency: item.currency === "USD" ? "USD" : "KRW",
          quantity: cleanDecimal(item.quantity),
          averagePrice: cleanDecimal(item.averagePrice),
          currentPrice: null,
          marketValue: null,
        }))
      : [];

  if (assetType === "brokerage" && holdings.length === 0) {
    throw new Error("주식 또는 ETF를 한 종목 이상 등록해 주세요.");
  }

  return {
    schemaVersion: ASSET_SCHEMA_VERSION,
    id: randomUUID(),
    ownerId: userId,
    assetType,
    provider: {
      code: providerCode(providerName),
      name: providerName,
      country: "KR",
    },
    connection: {
      mode: "manual",
      status: "active",
      externalConnectionId: null,
      lastSyncedAt: null,
    },
    accounts: [
      {
        id: randomUUID(),
        displayName,
        accountNumberMasked: maskedAccount(input.accountLastFour ?? ""),
        accountType,
        currency,
        balances:
          assetType === "bank"
            ? [
                {
                  assetCode: currency,
                  assetClass: "cash",
                  quantity: cleanDecimal(input.balance),
                  marketValue: cleanDecimal(input.balance),
                  currency,
                },
              ]
            : [],
        holdings,
      },
    ],
    metadata: { source: "manual", createdAt: now, updatedAt: now },
  };
}

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();

  try {
    await ensureAssetSchema();
    const result = await getTursoClient().execute({
      sql: `SELECT encrypted_payload, wrapped_secret
            FROM encrypted_asset_profiles
            WHERE user_id = ?
            ORDER BY updated_at DESC`,
      args: [user.id],
    });
    const assets = result.rows.map((row) =>
      decryptAssetJson<AssetProfileSummary>(
        String(row.encrypted_payload),
        String(row.wrapped_secret),
      ),
    );
    return Response.json(
      { assets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Encrypted asset lookup failed:", error);
    return Response.json(
      { error: "등록된 자산을 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();

  try {
    const input = (await request.json()) as CreateAssetInput;
    const profile = buildProfile(user.id, input);
    const encrypted = encryptAssetJson(profile);
    await ensureAssetSchema();
    await getTursoClient().execute({
      sql: `INSERT INTO encrypted_asset_profiles
            (id, user_id, asset_type, schema_version, encrypted_payload, wrapped_secret, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        profile.id,
        user.id,
        profile.assetType,
        profile.schemaVersion,
        encrypted.encryptedPayload,
        encrypted.wrappedSecret,
        profile.metadata.createdAt,
        profile.metadata.updatedAt,
      ],
    });
    await markAiGoalAssetChanged(user.id).catch((error) =>
      console.error("AI goal regeneration flag update failed:", error),
    );
    return Response.json({ asset: profile }, { status: 201 });
  } catch (error) {
    console.error("Encrypted asset save failed:", error);
    const isUserMessage =
      error instanceof Error && /[가-힣]/.test(error.message);
    return Response.json(
      {
        error: isUserMessage
          ? error.message
          : "자산 저장 중 오류가 발생했습니다.",
      },
      { status: isUserMessage ? 400 : 500 },
    );
  }
}
