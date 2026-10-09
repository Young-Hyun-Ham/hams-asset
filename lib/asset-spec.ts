export const ASSET_SCHEMA_VERSION = "1.0" as const;

export type AssetType = "bank" | "brokerage";

export type AssetHolding = {
  id: string;
  symbol: string;
  name: string;
  market: "KRX" | "KOSDAQ" | "NYSE" | "NASDAQ" | "OTHER";
  assetClass: "stock" | "etf";
  currency: "KRW" | "USD";
  quantity: string;
  averagePrice: string;
  currentPrice: string | null;
  marketValue: string | null;
};

export type AssetProfile = {
  schemaVersion: typeof ASSET_SCHEMA_VERSION;
  id: string;
  ownerId: string;
  assetType: AssetType;
  provider: {
    code: string;
    name: string;
    country: "KR";
  };
  connection: {
    mode: "manual" | "open_banking" | "mydata" | "broker_api";
    status: "active" | "disconnected" | "error";
    externalConnectionId: string | null;
    lastSyncedAt: string | null;
  };
  accounts: Array<{
    id: string;
    displayName: string;
    accountNumberMasked: string;
    accountType: "checking" | "savings" | "deposit" | "securities" | "isa" | "pension" | "cma";
    currency: "KRW" | "USD";
    balances: Array<{
      assetCode: string;
      assetClass: "cash";
      quantity: string;
      marketValue: string;
      currency: "KRW" | "USD";
    }>;
    holdings: AssetHolding[];
  }>;
  metadata: {
    source: "manual";
    createdAt: string;
    updatedAt: string;
  };
};

export type AssetProfileSummary = Pick<AssetProfile, "id" | "assetType" | "provider" | "connection" | "accounts" | "metadata">;

export function providerCode(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "manual-provider";
}

export function maskedAccount(lastFour: string) {
  const digits = lastFour.replace(/\D/g, "").slice(-4);
  return digits ? `****${digits}` : "****";
}

export function cleanDecimal(value: unknown, fallback = "0") {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  return /^\d+(?:\.\d+)?$/.test(normalized) ? normalized : fallback;
}
