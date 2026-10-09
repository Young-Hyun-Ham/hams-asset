import { getSsoUserFromRequest } from "@hams-fam/sso-client";

export function GET(request: Request) {
  return Response.json(
    { user: getSsoUserFromRequest(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
