import {
  getAppBaseUrl,
  getSsoClientId,
  getSsoServerUrl,
  normalizeReturnTo,
} from "@hams-fam/sso-client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const destination =
    request.nextUrl.searchParams.get("destination") === "services"
      ? "/profile/services"
      : "/profile";
  const returnTo = normalizeReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
  );
  const profileUrl = new URL(destination, getSsoServerUrl());
  profileUrl.searchParams.set("client_id", getSsoClientId());

  const serviceLoginUrl = new URL("/api/sso/login", getAppBaseUrl());
  serviceLoginUrl.searchParams.set("returnTo", returnTo);
  profileUrl.searchParams.set("return_to", serviceLoginUrl.toString());

  return NextResponse.redirect(profileUrl);
}
