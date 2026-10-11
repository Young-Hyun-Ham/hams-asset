"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AppSidebar from "@/components/AppSidebar";

type Goal = { targetAmount: number; monthlyContribution: number };
type Recommendation = {
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
type AnalysisSnapshot = {
  portfolio: {
    totalValueKrw: number;
    cashValueKrw: number;
    stockValueKrw: number;
    unrealizedGainKrw: number;
    unrealizedReturnPct: number;
    cashWeightPct: number;
    stockWeightPct: number;
  };
  holdings: Array<{
    name: string;
    symbol: string;
    marketValueKrw: number;
    unrealizedReturnPct: number;
    portfolioWeightPct: number;
    historical: {
      trailingReturnPct: number | null;
      annualizedVolatilityPct: number | null;
      maxDrawdownPct: number | null;
    };
    scenarioAnnualReturnPct: { conservative: number; base: number; optimistic: number };
  }>;
  goalScenarios: Array<{
    scenario: "보수적" | "기준" | "낙관적";
    expectedAnnualReturnPct: number;
    estimatedMonths: number | null;
  }>;
  methodology: string;
  dataLimitations: string[];
};
type AnalysisHistory = {
  recommendation: Recommendation;
  analysisSnapshot: AnalysisSnapshot;
  assetNames: string[];
  provider: string | null;
  model: string;
  createdAt: string;
  generationReason?: "initial" | "daily_refresh" | "asset_changed" | "manual";
  promptData?: { goal: Goal; systemPromptVersion: string };
};
const money = (value: number) =>
  `${Math.round(value).toLocaleString("ko-KR")}원`;
const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function HighlightedText({
  text,
  assetNames,
}: {
  text: string;
  assetNames: string[];
}) {
  const tokenPatterns = [
    "\\*\\*[^*]+\\*\\*",
    "\\d[\\d,]*(?:\\.\\d+)?\\s*(?:조|억|천만|만|천)?\\s*원?",
  ];
  if (assetNames.length)
    tokenPatterns.push(
      ...[...assetNames].sort((a, b) => b.length - a.length).map(escapePattern),
    );
  const pattern = new RegExp(`(${tokenPatterns.join("|")})`, "g");
  return (
    <>
      {text
        .split(pattern)
        .filter(Boolean)
        .map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return (
              <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
            );
          if (
            /^\d[\d,]*(?:\.\d+)?\s*(?:조|억|천만|만|천)?\s*원?$/.test(part) &&
            /(?:조|억|만|천|원)/.test(part)
          )
            return (
              <strong className="ai-money" key={`${part}-${index}`}>
                {part}
              </strong>
            );
          if (assetNames.includes(part))
            return (
              <strong className="ai-owned-asset" key={`${part}-${index}`}>
                {part}
              </strong>
            );
          return part;
        })}
    </>
  );
}

export default function GoalsPage() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [current, setCurrent] = useState(0);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    null,
  );
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [assetNames, setAssetNames] = useState<string[]>([]);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [analysisSnapshot, setAnalysisSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [histories, setHistories] = useState<AnalysisHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<AnalysisHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    const [goalResponse, portfolioResponse] = await Promise.all([
      fetch("/api/goal", { cache: "no-store" }),
      fetch("/api/portfolio", { cache: "no-store" }),
    ]);
    if (goalResponse.ok)
      setGoal(((await goalResponse.json()) as { goal: Goal | null }).goal);
    if (portfolioResponse.ok)
      setCurrent(((await portfolioResponse.json()) as { total: number }).total);
  }, []);

  const loadAiRecommendation = useCallback(async (forceGenerate = false) => {
    setAiLoading(true);
    setAiError("");
    let generationReason: "initial" | "daily_refresh" | "asset_changed" | "manual" | undefined;
    try {
      if (!forceGenerate) {
        const historyResponse = await fetch("/api/goal/ai-recommendation", {
          cache: "no-store",
        });
        if (historyResponse.ok) {
          const historyResult = (await historyResponse.json()) as {
            history: AnalysisHistory | null;
            shouldGenerate?: boolean;
            generationReason?: "initial" | "daily_refresh" | "asset_changed";
          };
          if (historyResult.history) {
            setAiAvailable(true);
            setAssetNames(historyResult.history.assetNames);
            setRecommendation(historyResult.history.recommendation);
            setAnalysisSnapshot(historyResult.history.analysisSnapshot);
            setAiGeneratedAt(historyResult.history.createdAt);
            if (!historyResult.shouldGenerate) return;
          }
          forceGenerate = true;
          generationReason = historyResult.generationReason ?? (historyResult.history ? "daily_refresh" : "initial");
        }
      }
      const response = await fetch("/api/goal/ai-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: forceGenerate ? (generationReason ?? "manual") : "initial" }),
        cache: "no-store",
      });
      const result = (await response.json()) as {
        available?: boolean;
        error?: string;
        assetNames?: string[];
        createdAt?: string;
        recommendation?: Recommendation;
        analysisSnapshot?: AnalysisSnapshot;
      };
      setAiAvailable(result.available ?? false);
      if (!response.ok || !result.recommendation)
        throw new Error(result.error || "AI 추천을 불러오지 못했습니다.");
      setAssetNames(result.assetNames ?? []);
      setRecommendation(result.recommendation);
      setAnalysisSnapshot(result.analysisSnapshot ?? null);
      setAiGeneratedAt(result.createdAt ?? null);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "AI 추천을 불러오지 못했습니다.",
      );
    } finally {
      setAiLoading(false);
    }
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/goal/ai-recommendation?scope=all", { cache: "no-store" });
      const result = await response.json() as { histories?: AnalysisHistory[] };
      if (!response.ok) throw new Error("이전 분석을 불러오지 못했습니다.");
      const items = result.histories ?? [];
      setHistories(items);
      setSelectedHistory(items[0] ?? null);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "이전 분석을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!goal) return;
    const timer = window.setTimeout(() => void loadAiRecommendation(), 0);
    return () => window.clearTimeout(timer);
  }, [goal, loadAiRecommendation]);

  const plan = useMemo(() => {
    if (!goal) return null;
    const remaining = Math.max(0, goal.targetAmount - current);
    const progress =
      goal.targetAmount > 0
        ? Math.min(100, (current / goal.targetAmount) * 100)
        : 0;
    const months =
      goal.monthlyContribution > 0
        ? Math.ceil(remaining / goal.monthlyContribution)
        : null;
    const monthlyRate = 0.05 / 12;
    let projectedMonths = 0,
      projected = current;
    while (projected < goal.targetAmount && projectedMonths < 1200) {
      projected = projected * (1 + monthlyRate) + goal.monthlyContribution;
      projectedMonths += 1;
    }
    return { remaining, progress, months, projectedMonths };
  }, [current, goal]);

  return (
    <div className="app-shell">
      <AppSidebar onChanged={() => void load()} />
      <main className="main sub-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">FINANCIAL GOAL</p>
            <h1>목표 자산 플랜</h1>
          </div>
        </header>
        {!goal ? (
          <section className="page-card goal-empty">
            <strong>설정된 목표 금액이 없습니다.</strong>
            <p>
              좌측 설정의 목표 설정 탭에서 목표 금액과 월 투자 가능 금액을
              입력해 주세요.
            </p>
          </section>
        ) : (
          <>
            <section className="goal-hero">
              <div>
                <small>나의 목표</small>
                <h2 className="goal-money">{money(goal.targetAmount)}</h2>
                <p>
                  현재 <b className="goal-money">{money(current)}</b> · 목표까지{" "}
                  <b className="goal-money">{money(plan?.remaining ?? 0)}</b>
                </p>
              </div>
              <div
                className="goal-ring"
                style={
                  {
                    "--progress": `${plan?.progress ?? 0}%`,
                  } as React.CSSProperties
                }
              >
                <strong>{(plan?.progress ?? 0).toFixed(1)}%</strong>
                <small>달성</small>
              </div>
            </section>
            <section className="summary-cards">
              <article>
                <small>매월 투자 계획</small>
                <strong className="goal-money">
                  {money(goal.monthlyContribution)}
                </strong>
              </article>
              <article>
                <small>수익률 없이 예상</small>
                <strong>
                  {plan?.months == null ? "계산 불가" : `${plan.months}개월`}
                </strong>
              </article>
              <article>
                <small>연 5% 가정 시</small>
                <strong>
                  {goal.monthlyContribution > 0
                    ? `${plan?.projectedMonths}개월`
                    : "계산 불가"}
                </strong>
              </article>
            </section>
            <section className="page-card advice-card">
              <h2>목표에 가까워지는 방법</h2>
              <p>
                현재 계획대로라면 매월 <b>{money(goal.monthlyContribution)}</b>
                을 투자할 때 연 5% 수익률 가정으로 약{" "}
                <b>{plan?.projectedMonths}개월</b>이 필요합니다.
              </p>
              <ul>
                <li>월 투자 금액을 자동이체로 먼저 확보하세요.</li>
                <li>
                  생활비 3~6개월분은 투자 자산과 분리해 비상금으로 유지하세요.
                </li>
                <li>
                  특정 종목 비중이 지나치게 높다면 정기적으로 리밸런싱하세요.
                </li>
                <li>6개월마다 목표와 납입액을 다시 점검하세요.</li>
              </ul>
              <small>
                연 5%는 계획 비교를 위한 단순 가정이며 투자 권유나 수익 보장이
                아닙니다.
              </small>
            </section>
            <section className="page-card ai-goal-card">
              <div className="section-title">
                <div>
                  <span>AI 맞춤 목표 방향</span>
                  <small>
                    {aiGeneratedAt
                      ? `오늘 마지막 분석 · ${new Date(aiGeneratedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
                      : "등록 자산과 목표를 함께 분석합니다."}
                  </small>
                </div>
                <div className="ai-goal-actions">
                  <button className="text-button" type="button" onClick={() => void openHistory()}>
                    이전 분석
                  </button>
                  {aiAvailable !== false && (
                    <button
                      className="text-button"
                      disabled={aiLoading}
                      onClick={() => void loadAiRecommendation(true)}
                    >
                      {aiLoading ? "분석 중..." : "다시 분석"}
                    </button>
                  )}
                </div>
              </div>
              {aiLoading && !recommendation ? (
                <div className="ai-loading">
                  등록 자산의 구성과 목표 달성 계획을 분석하고 있습니다.
                </div>
              ) : null}
              {recommendation ? (
                <div className="ai-recommendation">
                  <h2>
                    <HighlightedText
                      text={recommendation.headline}
                      assetNames={assetNames}
                    />
                  </h2>
                  <p>
                    <HighlightedText
                      text={recommendation.direction}
                      assetNames={assetNames}
                    />
                  </p>
                  {analysisSnapshot ? (
                    <>
                      <h3>객관적 자산 진단</h3>
                      <div className="ai-portfolio-summary">
                        <div><small>전체 자산</small><strong>{money(analysisSnapshot.portfolio.totalValueKrw)}</strong></div>
                        <div><small>현금 비중</small><strong>{analysisSnapshot.portfolio.cashWeightPct.toFixed(1)}%</strong></div>
                        <div><small>주식 비중</small><strong>{analysisSnapshot.portfolio.stockWeightPct.toFixed(1)}%</strong></div>
                        <div><small>주식 평가손익</small><strong className={analysisSnapshot.portfolio.unrealizedGainKrw >= 0 ? "positive" : "negative"}>{money(analysisSnapshot.portfolio.unrealizedGainKrw)} ({analysisSnapshot.portfolio.unrealizedReturnPct.toFixed(1)}%)</strong></div>
                      </div>
                      <p><HighlightedText text={recommendation.portfolioDiagnosis.summary} assetNames={assetNames} /></p>
                      <div className="ai-diagnosis-grid">
                        <p><strong>집중 위험 · {recommendation.portfolioDiagnosis.concentrationRisk}</strong><br />{recommendation.portfolioDiagnosis.cashAssessment}</p>
                        <p><strong>통화 위험</strong><br />{recommendation.portfolioDiagnosis.currencyRisk}</p>
                      </div>
                      <h3>목표 달성 시나리오</h3>
                      <div className="ai-scenario-grid">
                        {analysisSnapshot.goalScenarios.map((scenario) => (
                          <article key={scenario.scenario}>
                            <small>{scenario.scenario}</small>
                            <strong>연 {scenario.expectedAnnualReturnPct.toFixed(1)}% 가정</strong>
                            <span>{scenario.estimatedMonths === null ? "기간 계산 불가" : scenario.estimatedMonths === 0 ? "목표 달성" : `약 ${scenario.estimatedMonths}개월`}</span>
                          </article>
                        ))}
                      </div>
                      {analysisSnapshot.holdings.length > 0 ? (
                        <>
                          <h3>보유 종목 분석</h3>
                          <div className="ai-holding-list">
                            {analysisSnapshot.holdings.map((holding) => {
                              const aiHolding = recommendation.holdingAnalyses.find((item) => item.symbol === holding.symbol);
                              return (
                                <article key={`${holding.symbol}-${holding.name}`}>
                                  <div className="ai-holding-title">
                                    <strong className="ai-owned-asset">{holding.name} ({holding.symbol})</strong>
                                    <span>비중 {holding.portfolioWeightPct.toFixed(1)}%</span>
                                  </div>
                                  <div className="ai-holding-metrics">
                                    <span>평가 {money(holding.marketValueKrw)}</span>
                                    <span>평가수익률 {holding.unrealizedReturnPct.toFixed(1)}%</span>
                                    <span>최근 1년 {holding.historical.trailingReturnPct === null ? "자료 없음" : `${holding.historical.trailingReturnPct.toFixed(1)}%`}</span>
                                    <span>변동성 {holding.historical.annualizedVolatilityPct === null ? "자료 없음" : `${holding.historical.annualizedVolatilityPct.toFixed(1)}%`}</span>
                                    <span>최대 낙폭 {holding.historical.maxDrawdownPct === null ? "자료 없음" : `${holding.historical.maxDrawdownPct.toFixed(1)}%`}</span>
                                  </div>
                                  <p className="ai-return-range">시나리오 연 수익률 {holding.scenarioAnnualReturnPct.conservative.toFixed(1)}% ~ {holding.scenarioAnnualReturnPct.optimistic.toFixed(1)}% (기준 {holding.scenarioAnnualReturnPct.base.toFixed(1)}%)</p>
                                  {aiHolding ? <><p>{aiHolding.assessment}</p><p>{aiHolding.guidance}</p></> : null}
                                </article>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <h3>자산배분 방향</h3>
                  <ul>
                    {recommendation.allocationGuidance.map((guidance) => <li key={guidance}><HighlightedText text={guidance} assetNames={assetNames} /></li>)}
                  </ul>
                  <h3>추천 실행 계획</h3>
                  <ol>
                    {recommendation.actions.map((action) => (
                      <li key={action}>
                        <HighlightedText
                          text={action}
                          assetNames={assetNames}
                        />
                      </li>
                    ))}
                  </ol>
                  <div className="ai-cautions">
                    <strong>꼭 확인하세요</strong>
                    <ul>
                      {recommendation.cautions.map((caution) => (
                        <li key={caution}>
                          <HighlightedText
                            text={caution}
                            assetNames={assetNames}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                  {analysisSnapshot ? (
                    <div className="ai-methodology">
                      <strong>계산 가정과 한계</strong>
                      <p>{analysisSnapshot.methodology}</p>
                      <ul>
                        {analysisSnapshot.dataLimitations.map((item) => <li key={item}>{item}</li>)}
                        {recommendation.assumptions.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {aiError ? (
                <div
                  className={
                    aiAvailable === false
                      ? "ai-unavailable"
                      : "asset-settings-error"
                  }
                >
                  {aiError}
                </div>
              ) : null}
            </section>
          </>
        )}
      </main>
      {historyOpen ? createPortal(
        <div className="goal-history-backdrop" role="presentation" onMouseDown={() => setHistoryOpen(false)}>
          <section className="goal-history-modal" role="dialog" aria-modal="true" aria-label="이전 AI 목표 분석" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><small>AI ANALYSIS HISTORY</small><h2>이전 분석 히스토리</h2></div>
              <button type="button" aria-label="닫기" onClick={() => setHistoryOpen(false)}>×</button>
            </header>
            {historyLoading ? <div className="goal-history-empty">이전 분석을 불러오는 중입니다.</div> : histories.length === 0 ? <div className="goal-history-empty">저장된 분석이 없습니다.</div> : (
              <div className="goal-history-layout">
                <nav aria-label="분석 이력 목록">
                  {histories.map((history) => (
                    <button type="button" className={selectedHistory?.createdAt === history.createdAt ? "active" : ""} key={history.createdAt} onClick={() => setSelectedHistory(history)}>
                      <strong>{new Date(history.createdAt).toLocaleString("ko-KR")}</strong>
                      <span>{history.generationReason === "asset_changed" ? "자산 변경" : history.generationReason === "daily_refresh" ? "일일 갱신" : history.generationReason === "manual" ? "수동 분석" : "최초 분석"}</span>
                    </button>
                  ))}
                </nav>
                {selectedHistory ? (
                  <article className="goal-history-detail">
                    <div className="goal-history-meta">
                      <span>{selectedHistory.provider ?? "AI"} · {selectedHistory.model}</span>
                      {selectedHistory.promptData ? <span>목표 {money(selectedHistory.promptData.goal.targetAmount)} · 월 {money(selectedHistory.promptData.goal.monthlyContribution)}</span> : null}
                    </div>
                    <div className="ai-recommendation history-recommendation">
                      <h2><HighlightedText text={selectedHistory.recommendation.headline} assetNames={selectedHistory.assetNames} /></h2>
                      <p><HighlightedText text={selectedHistory.recommendation.direction} assetNames={selectedHistory.assetNames} /></p>
                      <h3>객관적 자산 진단</h3>
                      <div className="ai-portfolio-summary">
                        <div><small>전체 자산</small><strong>{money(selectedHistory.analysisSnapshot.portfolio.totalValueKrw)}</strong></div>
                        <div><small>현금 비중</small><strong>{selectedHistory.analysisSnapshot.portfolio.cashWeightPct.toFixed(1)}%</strong></div>
                        <div><small>주식 비중</small><strong>{selectedHistory.analysisSnapshot.portfolio.stockWeightPct.toFixed(1)}%</strong></div>
                        <div><small>주식 평가손익</small><strong className={selectedHistory.analysisSnapshot.portfolio.unrealizedGainKrw >= 0 ? "positive" : "negative"}>{money(selectedHistory.analysisSnapshot.portfolio.unrealizedGainKrw)} ({selectedHistory.analysisSnapshot.portfolio.unrealizedReturnPct.toFixed(1)}%)</strong></div>
                      </div>
                      <p><HighlightedText text={selectedHistory.recommendation.portfolioDiagnosis.summary} assetNames={selectedHistory.assetNames} /></p>
                      <div className="ai-diagnosis-grid">
                        <p><strong>집중 위험 · {selectedHistory.recommendation.portfolioDiagnosis.concentrationRisk}</strong><br />{selectedHistory.recommendation.portfolioDiagnosis.cashAssessment}</p>
                        <p><strong>통화 위험</strong><br />{selectedHistory.recommendation.portfolioDiagnosis.currencyRisk}</p>
                      </div>
                      <h3>목표 달성 시나리오</h3>
                      <div className="ai-scenario-grid">
                        {selectedHistory.analysisSnapshot.goalScenarios.map((scenario) => (
                          <article key={scenario.scenario}>
                            <small>{scenario.scenario}</small>
                            <strong>연 {scenario.expectedAnnualReturnPct.toFixed(1)}% 가정</strong>
                            <span>{scenario.estimatedMonths === null ? "기간 계산 불가" : scenario.estimatedMonths === 0 ? "목표 달성" : `약 ${scenario.estimatedMonths}개월`}</span>
                          </article>
                        ))}
                      </div>
                      {selectedHistory.analysisSnapshot.holdings.length > 0 ? (
                        <>
                          <h3>보유 종목 분석</h3>
                          <div className="ai-holding-list">
                            {selectedHistory.analysisSnapshot.holdings.map((holding) => {
                              const aiHolding = selectedHistory.recommendation.holdingAnalyses.find((item) => item.symbol === holding.symbol);
                              return (
                                <article key={`${holding.symbol}-${holding.name}`}>
                                  <div className="ai-holding-title"><strong className="ai-owned-asset">{holding.name} ({holding.symbol})</strong><span>비중 {holding.portfolioWeightPct.toFixed(1)}%</span></div>
                                  <div className="ai-holding-metrics">
                                    <span>평가 {money(holding.marketValueKrw)}</span><span>평가수익률 {holding.unrealizedReturnPct.toFixed(1)}%</span>
                                    <span>최근 1년 {holding.historical.trailingReturnPct === null ? "자료 없음" : `${holding.historical.trailingReturnPct.toFixed(1)}%`}</span>
                                    <span>변동성 {holding.historical.annualizedVolatilityPct === null ? "자료 없음" : `${holding.historical.annualizedVolatilityPct.toFixed(1)}%`}</span>
                                    <span>최대 낙폭 {holding.historical.maxDrawdownPct === null ? "자료 없음" : `${holding.historical.maxDrawdownPct.toFixed(1)}%`}</span>
                                  </div>
                                  <p className="ai-return-range">시나리오 연 수익률 {holding.scenarioAnnualReturnPct.conservative.toFixed(1)}% ~ {holding.scenarioAnnualReturnPct.optimistic.toFixed(1)}% (기준 {holding.scenarioAnnualReturnPct.base.toFixed(1)}%)</p>
                                  {aiHolding ? <><p>{aiHolding.assessment}</p><p>{aiHolding.guidance}</p></> : null}
                                </article>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                      <h3>자산배분 방향</h3>
                      <ul>{selectedHistory.recommendation.allocationGuidance.map((item) => <li key={item}><HighlightedText text={item} assetNames={selectedHistory.assetNames} /></li>)}</ul>
                      <h3>추천 실행 계획</h3>
                      <ol>{selectedHistory.recommendation.actions.map((item) => <li key={item}><HighlightedText text={item} assetNames={selectedHistory.assetNames} /></li>)}</ol>
                      <div className="ai-cautions"><strong>꼭 확인하세요</strong><ul>{selectedHistory.recommendation.cautions.map((item) => <li key={item}><HighlightedText text={item} assetNames={selectedHistory.assetNames} /></li>)}</ul></div>
                      <div className="ai-methodology">
                        <strong>계산 가정과 한계</strong><p>{selectedHistory.analysisSnapshot.methodology}</p>
                        <ul>{selectedHistory.analysisSnapshot.dataLimitations.map((item) => <li key={item}>{item}</li>)}{selectedHistory.recommendation.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            )}
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
