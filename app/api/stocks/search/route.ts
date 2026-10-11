import {
  getSsoUserFromRequest,
  unauthorizedSsoResponse,
} from "@hams-fam/sso-client";

import { searchStocks } from "@/lib/stock-catalog";

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").slice(0, 80);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const result = await searchStocks(query, Number.isFinite(page) ? page : 1);
    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Stock search failed:", error);
    return Response.json(
      { error: "종목 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 502 },
    );
  }
}
