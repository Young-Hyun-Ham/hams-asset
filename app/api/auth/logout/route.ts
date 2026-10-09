import { handleSsoLogout } from "@hams-fam/sso-client";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const response = await handleSsoLogout(request);
  const location = response.headers.get("location");

  if (!location) return response;

  const logoutUrl = new URL(location);
  logoutUrl.searchParams.set("redirect_to_service", "true");
  const headers = new Headers(response.headers);
  headers.set("location", logoutUrl.toString());

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
