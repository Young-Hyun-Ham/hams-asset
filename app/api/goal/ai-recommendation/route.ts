import {
  getSsoAccessTokenFromRequest,
  getSsoServerUrl,
  getSsoUserFromRequest,
  unauthorizedSsoResponse,
} from "@hams-fam/sso-client";
import { randomUUID } from "node:crypto";
import { decryptAssetJson, encryptAssetJson } from "@/lib/asset-crypto";
import type { AssetHolding, AssetProfile } from "@/lib/asset-spec";
import {
  getHistoricalMetrics,
  type HistoricalMetrics,
} from "@/lib/market-history";
import { getMarketQuote, getUsdKrwRate } from "@/lib/market-prices";
import { ensureAssetSchema, getTursoClient } from "@/lib/turso";
import {
  clearAiGoalRegenerationRequired,
  getAiGoalSettings,
} from "@/lib/ai-goal-settings";
import type { AssetGoal } from "../route";

type AiResult = {
  headline: string;
  direction: string;
  portfolioDiagnosis: {
    summary: string;
    concentrationRisk: "낮음" | "보통" | "높음";
    cashAssessment: string;
    currencyRisk: string;
  };
  holdingAnalyses: Array<{
    symbol: string;
    name: string;
    assessment: string;
    scenarioComment: string;
    riskFactors: string[];
    guidance: string;
  }>;
  allocationGuidance: string[];
  actions: string[];
  cautions: string[];
  assumptions: string[];
};

type HoldingAnalysis = {
  type: "stock" | "etf";
  provider: string;
  accountName: string;
  name: string;
  symbol: string;
  market: AssetHolding["market"];
  currency: AssetHolding["currency"];
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  costKrw: number;
  marketValueKrw: number;
  unrealizedGainKrw: number;
  unrealizedReturnPct: number;
  portfolioWeightPct: number;
  dailyChangePct: number;
  quoteSource: "NAVER" | "NASDAQ" | "MANUAL";
  quoteRealTime: boolean;
  quotedAt: string;
  historical: HistoricalMetrics;
  scenarioAnnualReturnPct: {
    conservative: number;
    base: number;
    optimistic: number;
  };
};

type AnalysisSnapshot = {
  asOf: string;
  usdKrw: number;
  portfolio: {
    totalValueKrw: number;
    cashValueKrw: number;
    stockValueKrw: number;
    stockCostKrw: number;
    unrealizedGainKrw: number;
    unrealizedReturnPct: number;
    cashWeightPct: number;
    stockWeightPct: number;
  };
  cashAssets: Array<{
    provider: string;
    accountName: string;
    currency: "KRW" | "USD";
    originalAmount: number;
    valueKrw: number;
  }>;
  holdings: HoldingAnalysis[];
  goalScenarios: Array<{
    scenario: "보수적" | "기준" | "낙관적";
    expectedAnnualReturnPct: number;
    estimatedMonths: number | null;
    estimatedDate: string | null;
  }>;
  methodology: string;
  dataLimitations: string[];
};

type AiHistory = {
  version: 2;
  recommendation: AiResult;
  analysisSnapshot: AnalysisSnapshot;
  assetNames: string[];
  provider: string | null;
  model: string;
  createdAt: string;
  generationReason: "initial" | "daily_refresh" | "asset_changed" | "manual";
  promptData: {
    systemPromptVersion: "asset_goal_recommendation_v2";
    goal: AssetGoal;
    objectiveAnalysis: AnalysisSnapshot;
    outputRules: {
      factsAndAssumptionsMustBeSeparated: true;
      scenarioReturnsAreNotForecastsOrGuarantees: true;
      mentionDataLimitations: true;
    };
  };
};

const koreaDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function holdingScenario(
  assetClass: AssetHolding["assetClass"],
  history: HistoricalMetrics,
) {
  const anchor = assetClass === "etf" ? 5 : 4;
  const base =
    history.trailingReturnPct === null
      ? anchor
      : clamp(anchor * 0.75 + history.trailingReturnPct * 0.25, -5, 12);
  const uncertainty =
    history.annualizedVolatilityPct === null
      ? assetClass === "etf"
        ? 8
        : 12
      : clamp(history.annualizedVolatilityPct * 0.5, 5, 20);
  return {
    conservative: round(clamp(base - uncertainty, -30, base)),
    base: round(base),
    optimistic: round(clamp(base + uncertainty, base, 30)),
  };
}

function estimateGoalMonths(
  current: number,
  target: number,
  monthlyContribution: number,
  annualReturnPct: number,
) {
  if (current >= target) return 0;
  const monthlyRate = (1 + annualReturnPct / 100) ** (1 / 12) - 1;
  let balance = current;
  for (let month = 1; month <= 1200; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (balance >= target) return month;
    if (!Number.isFinite(balance) || balance < 0) return null;
  }
  return null;
}

function addMonths(months: number | null) {
  if (months === null) return null;
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

async function buildAnalysisSnapshot(
  profiles: AssetProfile[],
  goal: AssetGoal,
): Promise<AnalysisSnapshot> {
  const usdKrw = await getUsdKrwRate();
  const cashAssets: AnalysisSnapshot["cashAssets"] = [];
  const rawHoldings: Array<{
    holding: AssetHolding;
    provider: string;
    accountName: string;
  }> = [];
  for (const profile of profiles) {
    for (const account of profile.accounts) {
      for (const balance of account.balances) {
        const originalAmount = Number(balance.marketValue);
        cashAssets.push({
          provider: profile.provider.name,
          accountName: account.displayName,
          currency: balance.currency,
          originalAmount,
          valueKrw: originalAmount * (balance.currency === "USD" ? usdKrw : 1),
        });
      }
      for (const holding of account.holdings)
        rawHoldings.push({
          holding,
          provider: profile.provider.name,
          accountName: account.displayName,
        });
    }
  }

  const quoted = await Promise.all(
    rawHoldings.map(async (item) => ({
      ...item,
      quote: await getMarketQuote(item.holding),
    })),
  );
  const preliminary = quoted.map((item) => {
    const exchange = item.holding.currency === "USD" ? usdKrw : 1;
    const quantity = Number(item.holding.quantity);
    return {
      ...item,
      costKrw: quantity * Number(item.holding.averagePrice) * exchange,
      marketValueKrw: quantity * item.quote.price * exchange,
    };
  });
  const historicalTargets = new Set(
    [...preliminary]
      .sort((a, b) => b.marketValueKrw - a.marketValueKrw)
      .slice(0, 20)
      .map((item) => item.holding.id),
  );
  const histories = new Map(
    await Promise.all(
      preliminary.map(
        async (item) =>
          [
            item.holding.id,
            historicalTargets.has(item.holding.id)
              ? await getHistoricalMetrics(
                  item.holding.symbol,
                  item.holding.market,
                )
              : null,
          ] as const,
      ),
    ),
  );

  const cashValueKrw = cashAssets.reduce(
    (sum, asset) => sum + asset.valueKrw,
    0,
  );
  const stockValueKrw = preliminary.reduce(
    (sum, item) => sum + item.marketValueKrw,
    0,
  );
  const stockCostKrw = preliminary.reduce((sum, item) => sum + item.costKrw, 0);
  const totalValueKrw = cashValueKrw + stockValueKrw;
  const unavailableHistory = (): HistoricalMetrics => ({
    source: "UNAVAILABLE",
    periodDays: 365,
    observationCount: 0,
    trailingReturnPct: null,
    annualizedVolatilityPct: null,
    maxDrawdownPct: null,
    asOf: null,
  });
  const holdings: HoldingAnalysis[] = preliminary.map((item) => {
    const historical = histories.get(item.holding.id) ?? unavailableHistory();
    return {
      type: item.holding.assetClass,
      provider: item.provider,
      accountName: item.accountName,
      name: item.holding.name,
      symbol: item.holding.symbol,
      market: item.holding.market,
      currency: item.holding.currency,
      quantity: Number(item.holding.quantity),
      averagePrice: Number(item.holding.averagePrice),
      currentPrice: item.quote.price,
      costKrw: round(item.costKrw),
      marketValueKrw: round(item.marketValueKrw),
      unrealizedGainKrw: round(item.marketValueKrw - item.costKrw),
      unrealizedReturnPct: round(
        item.costKrw > 0 ? (item.marketValueKrw / item.costKrw - 1) * 100 : 0,
      ),
      portfolioWeightPct: round(
        totalValueKrw > 0 ? (item.marketValueKrw / totalValueKrw) * 100 : 0,
      ),
      dailyChangePct: round(item.quote.changeRate),
      quoteSource: item.quote.source,
      quoteRealTime: item.quote.isRealTime,
      quotedAt: item.quote.quotedAt,
      historical,
      scenarioAnnualReturnPct: holdingScenario(
        item.holding.assetClass,
        historical,
      ),
    };
  });

  const scenarioKeys = [
    {
      scenario: "보수적" as const,
      key: "conservative" as const,
      cashReturn: 1,
    },
    { scenario: "기준" as const, key: "base" as const, cashReturn: 2 },
    { scenario: "낙관적" as const, key: "optimistic" as const, cashReturn: 3 },
  ];
  const goalScenarios = scenarioKeys.map(({ scenario, key, cashReturn }) => {
    const stockReturnAmount = holdings.reduce(
      (sum, holding) =>
        sum +
        (holding.marketValueKrw * holding.scenarioAnnualReturnPct[key]) / 100,
      0,
    );
    const expectedAnnualReturnPct =
      totalValueKrw > 0
        ? (((cashValueKrw * cashReturn) / 100 + stockReturnAmount) /
            totalValueKrw) *
          100
        : 0;
    const estimatedMonths = estimateGoalMonths(
      totalValueKrw,
      goal.targetAmount,
      goal.monthlyContribution,
      expectedAnnualReturnPct,
    );
    return {
      scenario,
      expectedAnnualReturnPct: round(expectedAnnualReturnPct),
      estimatedMonths,
      estimatedDate: addMonths(estimatedMonths),
    };
  });

  const dataLimitations: string[] = [];
  if (holdings.some((holding) => holding.quoteSource === "MANUAL"))
    dataLimitations.push(
      "일부 종목은 현재가 조회에 실패해 등록된 평균 매입가를 대체값으로 사용했습니다.",
    );
  if (holdings.some((holding) => holding.historical.source === "UNAVAILABLE"))
    dataLimitations.push(
      "일부 종목은 최근 1년 가격 이력을 확보하지 못해 자산 유형별 기본 가정을 사용했습니다.",
    );
  if (rawHoldings.length > 20)
    dataLimitations.push(
      "과거 가격 분석은 평가금액 상위 20개 종목에 한해 수행했습니다.",
    );
  dataLimitations.push(
    "세금, 수수료, 배당, 환전 비용과 향후 환율 변동은 목표 기간 계산에 반영하지 않았습니다.",
  );

  return {
    asOf: new Date().toISOString(),
    usdKrw: round(usdKrw, 4),
    portfolio: {
      totalValueKrw: round(totalValueKrw),
      cashValueKrw: round(cashValueKrw),
      stockValueKrw: round(stockValueKrw),
      stockCostKrw: round(stockCostKrw),
      unrealizedGainKrw: round(stockValueKrw - stockCostKrw),
      unrealizedReturnPct: round(
        stockCostKrw > 0 ? (stockValueKrw / stockCostKrw - 1) * 100 : 0,
      ),
      cashWeightPct: round(
        totalValueKrw > 0 ? (cashValueKrw / totalValueKrw) * 100 : 0,
      ),
      stockWeightPct: round(
        totalValueKrw > 0 ? (stockValueKrw / totalValueKrw) * 100 : 0,
      ),
    },
    cashAssets,
    holdings,
    goalScenarios,
    methodology:
      "종목별 기준 수익률은 자산 유형 장기 가정(개별주식 4%, ETF 5%) 75%와 최근 1년 수익률 25%를 혼합하고, 연환산 변동성의 50%를 보수·낙관 범위로 적용했습니다. 현금은 연 1%·2%·3%를 가정했습니다. 이는 예측이나 수익 보장이 아닌 목표 계획용 민감도 분석입니다.",
    dataLimitations,
  };
}

export async function GET(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  await ensureAssetSchema();
  const showAll = new URL(request.url).searchParams.get("scope") === "all";
  const result = await getTursoClient().execute({
    sql: `SELECT encrypted_payload, wrapped_secret FROM encrypted_ai_goal_history
          WHERE user_id = ? ORDER BY created_at DESC LIMIT ${showAll ? 50 : 1}`,
    args: [user.id],
  });
  if (showAll) {
    const histories = result.rows
      .map((row) => decryptAssetJson<Partial<AiHistory>>(
        String(row.encrypted_payload),
        String(row.wrapped_secret),
      ))
      .filter((history) => history.version === 2);
    return Response.json(
      { histories },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const row = result.rows[0];
  if (!row)
    return Response.json({
      history: null,
      shouldGenerate: true,
      generationReason: "initial",
    });
  const history = decryptAssetJson<Partial<AiHistory>>(
    String(row.encrypted_payload),
    String(row.wrapped_secret),
  );
  const settings = await getAiGoalSettings(user.id);
  const isToday = Boolean(
    history.createdAt && koreaDate(history.createdAt) === koreaDate(new Date()),
  );
  const shouldGenerate =
    history.version !== 2 || !isToday || settings.regenerationRequired;
  const generationReason = settings.regenerationRequired
    ? "asset_changed"
    : !isToday
      ? "daily_refresh"
      : null;
  return Response.json(
    {
      history: history.version === 2 ? history : null,
      shouldGenerate,
      generationReason,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const user = getSsoUserFromRequest(request);
  if (!user) return unauthorizedSsoResponse();
  const accessToken = getSsoAccessTokenFromRequest(request);
  if (!accessToken)
    return Response.json(
      {
        available: false,
        error: "SSO AI 연결 토큰이 없습니다. 다시 로그인해 주세요.",
      },
      { status: 401 },
    );
  try {
    const requestBody = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };
    const allowedReasons = new Set([
      "initial",
      "daily_refresh",
      "asset_changed",
      "manual",
    ]);
    const generationReason = (allowedReasons.has(requestBody.reason ?? "")
      ? requestBody.reason
      : "manual") as AiHistory["generationReason"];
    const modelResponse = await fetch(
      new URL("/api/sso/ai/models", getSsoServerUrl()),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const modelPayload = (await modelResponse.json().catch(() => null)) as {
      ok?: boolean;
      provider?: string;
      defaultModel?: string | null;
      models?: Array<{ id?: string }>;
      error?: string;
      message?: string;
    } | null;
    if (!modelResponse.ok || !modelPayload?.ok) {
      const unavailable =
        modelResponse.status === 422 ||
        modelPayload?.error === "ai_configuration_missing";
      return Response.json(
        {
          available: !unavailable,
          error:
            modelPayload?.message ||
            (unavailable
              ? "회원정보에 AI API 키를 등록해 주세요."
              : "사용 가능한 AI 모델을 조회하지 못했습니다."),
        },
        { status: modelResponse.status || 502 },
      );
    }
    const models = (modelPayload.models ?? [])
      .map((item) => item.id?.trim() ?? "")
      .filter(Boolean);
    const model =
      modelPayload.defaultModel && models.includes(modelPayload.defaultModel)
        ? modelPayload.defaultModel
        : models[0];
    if (!model)
      return Response.json(
        { available: false, error: "사용 가능한 AI 모델이 없습니다." },
        { status: 422 },
      );

    await ensureAssetSchema();
    const [goalRows, assetRows] = await Promise.all([
      getTursoClient().execute({
        sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_user_goals WHERE user_id = ?",
        args: [user.id],
      }),
      getTursoClient().execute({
        sql: "SELECT encrypted_payload, wrapped_secret FROM encrypted_asset_profiles WHERE user_id = ?",
        args: [user.id],
      }),
    ]);
    const goalRow = goalRows.rows[0];
    if (!goalRow)
      return Response.json(
        { available: false, error: "목표 금액을 먼저 설정해 주세요." },
        { status: 400 },
      );
    const goal = decryptAssetJson<AssetGoal>(
      String(goalRow.encrypted_payload),
      String(goalRow.wrapped_secret),
    );
    const profiles = assetRows.rows.map((row) =>
      decryptAssetJson<AssetProfile>(
        String(row.encrypted_payload),
        String(row.wrapped_secret),
      ),
    );
    const analysisSnapshot = await buildAnalysisSnapshot(profiles, goal);

    const aiResponse = await fetch(`${getSsoServerUrl()}/api/sso/ai/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        model,
        instructions: `당신은 근거와 불확실성을 명확히 구분하는 개인 자산 목표 분석가입니다.
서버가 계산한 수치만 사실로 사용하고 누락된 데이터나 미래 가격을 임의로 만들지 마세요.
수익률은 보장값이 아니라 보수적·기준·낙관적 가정 범위라고 명시하세요.
현금 흐름, 비상자금, 자산 및 종목 집중도, 통화·시장 위험, 손실 가능성을 함께 분석하세요.
특정 종목의 단정적인 매수·매도 명령이나 목표 주가를 제시하지 말고 조건부 점검 및 리밸런싱 기준을 제안하세요.
목표 달성 전략은 월 투자금 조정, 분산, 자산배분, 정기 점검을 함께 다루세요.
각 보유 종목은 현재 평가손익, 포트폴리오 비중, 최근 1년 수익률·변동성·최대 낙폭과 시나리오 수익률을 근거로 설명하세요.
답변은 간결하고 이해하기 쉬운 한국어로 작성하세요.`,
        prompt: JSON.stringify({
          goal,
          objectiveAnalysis: analysisSnapshot,
          outputRules: {
            factsAndAssumptionsMustBeSeparated: true,
            scenarioReturnsAreNotForecastsOrGuarantees: true,
            mentionDataLimitations: true,
          },
        }),
        schemaName: "asset_goal_recommendation_v2",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            headline: { type: "string" },
            direction: { type: "string" },
            portfolioDiagnosis: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                concentrationRisk: {
                  type: "string",
                  enum: ["낮음", "보통", "높음"],
                },
                cashAssessment: { type: "string" },
                currencyRisk: { type: "string" },
              },
              required: [
                "summary",
                "concentrationRisk",
                "cashAssessment",
                "currencyRisk",
              ],
            },
            holdingAnalyses: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  symbol: { type: "string" },
                  name: { type: "string" },
                  assessment: { type: "string" },
                  scenarioComment: { type: "string" },
                  riskFactors: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 4,
                  },
                  guidance: { type: "string" },
                },
                required: [
                  "symbol",
                  "name",
                  "assessment",
                  "scenarioComment",
                  "riskFactors",
                  "guidance",
                ],
              },
            },
            allocationGuidance: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
            },
            actions: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 6,
            },
            cautions: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
            },
            assumptions: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 6,
            },
          },
          required: [
            "headline",
            "direction",
            "portfolioDiagnosis",
            "holdingAnalyses",
            "allocationGuidance",
            "actions",
            "cautions",
            "assumptions",
          ],
        },
        maxOutputTokens: 4000,
        reasoningEffort: "medium",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = (await aiResponse.json()) as {
      ok?: boolean;
      output?: string;
      message?: string;
      error?: string;
    };
    if (!aiResponse.ok || !payload.output) {
      const missing =
        aiResponse.status === 422 ||
        payload.error === "ai_configuration_missing";
      return Response.json(
        {
          available: !missing,
          error: missing
            ? "회원정보에 AI API 키를 등록해 주세요."
            : payload.message || "AI 추천을 생성하지 못했습니다.",
        },
        { status: aiResponse.status },
      );
    }
    const recommendation = JSON.parse(payload.output) as AiResult;
    const assetNames = Array.from(
      new Set(
        [
          ...analysisSnapshot.cashAssets.flatMap((asset) => [
            asset.provider,
            asset.accountName,
          ]),
          ...analysisSnapshot.holdings.flatMap((asset) => [
            asset.name,
            asset.symbol,
          ]),
        ].filter(Boolean),
      ),
    );
    const history: AiHistory = {
      version: 2,
      recommendation,
      analysisSnapshot,
      assetNames,
      provider: modelPayload.provider ?? null,
      model,
      createdAt: new Date().toISOString(),
      generationReason,
      promptData: {
        systemPromptVersion: "asset_goal_recommendation_v2",
        goal,
        objectiveAnalysis: analysisSnapshot,
        outputRules: {
          factsAndAssumptionsMustBeSeparated: true,
          scenarioReturnsAreNotForecastsOrGuarantees: true,
          mentionDataLimitations: true,
        },
      },
    };
    const encrypted = encryptAssetJson(history);
    await getTursoClient().execute({
      sql: "INSERT INTO encrypted_ai_goal_history (id, user_id, encrypted_payload, wrapped_secret, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        encrypted.encryptedPayload,
        encrypted.wrappedSecret,
        history.createdAt,
      ],
    });
    await clearAiGoalRegenerationRequired(user.id);
    return Response.json(
      { available: true, ...history },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("AI goal recommendation failed:", error);
    return Response.json(
      {
        available: true,
        error: "AI 목표 추천을 생성하는 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
