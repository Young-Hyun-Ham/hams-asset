import { handleSsoLogin } from "@hams-fam/sso-client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    const ssoUrl = new URL(process.env.HAMS_OAUTH_SERVER_URL ?? "");

    if (appUrl.origin === ssoUrl.origin) {
      throw new Error("The service URL and SSO server URL are misconfigured.");
    }
  } catch (error) {
    console.error("SSO login configuration error:", error);
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set("loginError", "sso_configuration");
    return NextResponse.redirect(errorUrl);
  }

  return handleSsoLogin(request);
}
