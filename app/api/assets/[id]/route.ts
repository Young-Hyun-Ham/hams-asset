import { getSsoUserFromRequest, unauthorizedSsoResponse } from "@hams-fam/sso-client";

import { ensureAssetSchema, getTursoClient } from "@/lib/turso";

export async function DELETE(request: Request, context: RouteContext<"/api/assets/[id]">) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  const { id } = await context.params;

  try {
    await ensureAssetSchema();
    const result = await getTursoClient().execute({
      sql: "DELETE FROM encrypted_asset_profiles WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    if (result.rowsAffected === 0) {
      return Response.json({ error: "자산을 찾을 수 없습니다." }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Encrypted asset deletion failed:", error);
    return Response.json(
      { error: "자산을 삭제하는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
