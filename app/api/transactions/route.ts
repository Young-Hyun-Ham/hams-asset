import { randomUUID } from "node:crypto";
import { getSsoUserFromRequest, unauthorizedSsoResponse } from "@hams-fam/sso-client";
import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";

const types = new Set(["buy", "sell", "deposit", "withdrawal", "dividend", "interest"]);
export type AssetTransaction = { id: string; accountId: string; accountName: string; type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "interest"; occurredAt: string; assetName: string; symbol: string; quantity: number; unitPrice: number; amount: number; fee: number; currency: "KRW" | "USD"; memo: string; createdAt: string };

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  await ensureAssetSchema();
  const result = await getTursoClient().execute({ sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_asset_transactions WHERE user_id = ? ORDER BY occurred_at DESC", args: [user.id] });
  const transactions = result.rows.map((row) => decryptAssetJson<AssetTransaction>(String(row.encrypted_payload), String(row.wrapped_secret)));
  return Response.json({ transactions }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  try {
    const input = await request.json() as Partial<AssetTransaction>;
    if (!input.accountId || !input.accountName) throw new Error("계좌를 선택해 주세요.");
    if (!input.type || !types.has(input.type)) throw new Error("거래 유형을 선택해 주세요.");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("거래 금액을 올바르게 입력해 주세요.");
    const transaction: AssetTransaction = {
      id: randomUUID(), accountId: input.accountId, accountName: input.accountName,
      type: input.type, occurredAt: input.occurredAt || new Date().toISOString().slice(0, 10),
      assetName: String(input.assetName ?? "").trim(), symbol: String(input.symbol ?? "").trim().toUpperCase(),
      quantity: Math.max(0, Number(input.quantity) || 0), unitPrice: Math.max(0, Number(input.unitPrice) || 0),
      amount, fee: Math.max(0, Number(input.fee) || 0), currency: input.currency === "USD" ? "USD" : "KRW",
      memo: String(input.memo ?? "").trim().slice(0, 200), createdAt: new Date().toISOString(),
    };
    const encrypted = encryptAssetJson(transaction);
    await ensureAssetSchema();
    await getTursoClient().execute({ sql: "INSERT INTO encrypted_asset_transactions (id, user_id, encrypted_payload, wrapped_secret, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?)", args: [transaction.id, user.id, encrypted.encryptedPayload, encrypted.wrappedSecret, transaction.occurredAt, transaction.createdAt] });
    return Response.json({ transaction }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "거래를 저장하지 못했습니다." }, { status: 400 });
  }
}
