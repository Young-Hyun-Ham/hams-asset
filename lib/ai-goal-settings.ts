import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";

export type AiGoalSettings = {
  regenerateOnAssetChange: boolean;
  regenerationRequired: boolean;
  assetChangedAt: string | null;
  updatedAt: string;
};

const defaults = (): AiGoalSettings => ({
  regenerateOnAssetChange: false,
  regenerationRequired: false,
  assetChangedAt: null,
  updatedAt: new Date().toISOString(),
});

export async function getAiGoalSettings(userId: string) {
  await ensureAssetSchema();
  const result = await getTursoClient().execute({
    sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_ai_goal_settings WHERE user_id = ?",
    args: [userId],
  });
  const row = result.rows[0];
  return row
    ? { ...defaults(), ...decryptAssetJson<AiGoalSettings>(String(row.encrypted_payload), String(row.wrapped_secret)) }
    : defaults();
}

export async function saveAiGoalSettings(userId: string, settings: AiGoalSettings) {
  const encrypted = encryptAssetJson(settings);
  await ensureAssetSchema();
  await getTursoClient().execute({
    sql: `INSERT INTO encrypted_ai_goal_settings (user_id, encrypted_payload, wrapped_secret, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET encrypted_payload = excluded.encrypted_payload,
          wrapped_secret = excluded.wrapped_secret, updated_at = excluded.updated_at`,
    args: [userId, encrypted.encryptedPayload, encrypted.wrappedSecret, settings.updatedAt],
  });
  return settings;
}

export async function markAiGoalAssetChanged(userId: string) {
  const settings = await getAiGoalSettings(userId);
  if (!settings.regenerateOnAssetChange) return;
  const now = new Date().toISOString();
  await saveAiGoalSettings(userId, { ...settings, regenerationRequired: true, assetChangedAt: now, updatedAt: now });
}

export async function clearAiGoalRegenerationRequired(userId: string) {
  const settings = await getAiGoalSettings(userId);
  if (!settings.regenerationRequired) return;
  await saveAiGoalSettings(userId, { ...settings, regenerationRequired: false, updatedAt: new Date().toISOString() });
}
