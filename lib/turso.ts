import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;
let schemaReady: Promise<void> | null = null;

export function getTursoClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not configured.");

  client = createClient({ url, authToken });
  return client;
}

export function ensureAssetSchema() {
  if (!schemaReady) {
    schemaReady = getTursoClient()
      .execute(`
        CREATE TABLE IF NOT EXISTS encrypted_asset_profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          asset_type TEXT NOT NULL CHECK (asset_type IN ('bank', 'brokerage')),
          schema_version TEXT NOT NULL,
          encrypted_payload TEXT NOT NULL,
          wrapped_secret TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)
      .then(async () => {
        await getTursoClient().execute(`
          CREATE INDEX IF NOT EXISTS idx_asset_profiles_user_updated
          ON encrypted_asset_profiles(user_id, updated_at DESC)
        `);
        await getTursoClient().execute(`
          CREATE TABLE IF NOT EXISTS encrypted_user_goals (
            user_id TEXT PRIMARY KEY,
            encrypted_payload TEXT NOT NULL,
            wrapped_secret TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        await getTursoClient().execute(`
          CREATE TABLE IF NOT EXISTS encrypted_ai_goal_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            encrypted_payload TEXT NOT NULL,
            wrapped_secret TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `);
        await getTursoClient().execute(`
          CREATE INDEX IF NOT EXISTS idx_ai_goal_history_user_created
          ON encrypted_ai_goal_history(user_id, created_at DESC)
        `);
        await getTursoClient().execute(`
          CREATE TABLE IF NOT EXISTS encrypted_ai_goal_settings (
            user_id TEXT PRIMARY KEY,
            encrypted_payload TEXT NOT NULL,
            wrapped_secret TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        await getTursoClient().execute(`
          CREATE TABLE IF NOT EXISTS encrypted_asset_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            encrypted_payload TEXT NOT NULL,
            wrapped_secret TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `);
        await getTursoClient().execute(`
          CREATE INDEX IF NOT EXISTS idx_asset_transactions_user_occurred
          ON encrypted_asset_transactions(user_id, occurred_at DESC)
        `);
      });
  }

  return schemaReady;
}
