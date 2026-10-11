import {
  getSsoUserFromRequest,
  unauthorizedSsoResponse,
} from "@hams-fam/sso-client";
import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";

export type AssetGoal = {
  targetAmount: number;
  monthlyContribution: number;
  updatedAt: string;
};

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  await ensureAssetSchema();
  const result = await getTursoClient().execute({
    sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_user_goals WHERE user_id = ?",
    args: [user.id],
  });
  const row = result.rows[0];
  const goal = row
    ? decryptAssetJson<AssetGoal>(
        String(row.encrypted_payload),
        String(row.wrapped_secret),
      )
    : null;
  return Response.json(
    { goal },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  try {
    const input = (await request.json()) as Partial<AssetGoal>;
    const targetAmount = Number(input.targetAmount);
    const monthlyContribution = Number(input.monthlyContribution);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0)
      throw new Error("목표 금액을 0보다 크게 입력해 주세요.");
    if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0)
      throw new Error("월 투자 가능 금액을 올바르게 입력해 주세요.");
    const goal: AssetGoal = {
      targetAmount,
      monthlyContribution,
      updatedAt: new Date().toISOString(),
    };
    const encrypted = encryptAssetJson(goal);
    await ensureAssetSchema();
    await getTursoClient().execute({
      sql: `INSERT INTO encrypted_user_goals (user_id, encrypted_payload, wrapped_secret, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET encrypted_payload = excluded.encrypted_payload,
            wrapped_secret = excluded.wrapped_secret, updated_at = excluded.updated_at`,
      args: [
        user.id,
        encrypted.encryptedPayload,
        encrypted.wrappedSecret,
        goal.updatedAt,
      ],
    });
    return Response.json({ goal });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "목표를 저장하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
