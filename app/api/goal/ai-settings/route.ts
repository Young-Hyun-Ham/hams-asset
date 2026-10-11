import { getSsoUserFromRequest, unauthorizedSsoResponse } from "@hams-fam/sso-client";
import { getAiGoalSettings, saveAiGoalSettings } from "@/lib/ai-goal-settings";

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  return Response.json({ settings: await getAiGoalSettings(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  const input = await request.json() as { regenerateOnAssetChange?: unknown };
  if (typeof input.regenerateOnAssetChange !== "boolean")
    return Response.json({ error: "자동 재분석 옵션 값이 올바르지 않습니다." }, { status: 400 });
  const current = await getAiGoalSettings(user.id);
  const settings = await saveAiGoalSettings(user.id, {
    ...current,
    regenerateOnAssetChange: input.regenerateOnAssetChange,
    regenerationRequired: input.regenerateOnAssetChange ? current.regenerationRequired : false,
    updatedAt: new Date().toISOString(),
  });
  return Response.json({ settings });
}
