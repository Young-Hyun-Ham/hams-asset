"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/AppSidebar";

type Goal = { targetAmount: number; monthlyContribution: number };
type Recommendation = { headline: string; direction: string; actions: string[]; cautions: string[] };
const money = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function HighlightedText({ text, assetNames }: { text: string; assetNames: string[] }) {
  const tokenPatterns = ["\\*\\*[^*]+\\*\\*", "\\d[\\d,]*(?:\\.\\d+)?\\s*(?:조|억|천만|만|천)?\\s*원?"];
  if (assetNames.length) tokenPatterns.push(...[...assetNames].sort((a, b) => b.length - a.length).map(escapePattern));
  const pattern = new RegExp(`(${tokenPatterns.join("|")})`, "g");
  return <>{text.split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    if (/^\d[\d,]*(?:\.\d+)?\s*(?:조|억|천만|만|천)?\s*원?$/.test(part) && /(?:조|억|만|천|원)/.test(part)) return <strong className="ai-money" key={`${part}-${index}`}>{part}</strong>;
    if (assetNames.includes(part)) return <strong className="ai-owned-asset" key={`${part}-${index}`}>{part}</strong>;
    return part;
  })}</>;
}

export default function GoalsPage() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [current, setCurrent] = useState(0);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [assetNames, setAssetNames] = useState<string[]>([]);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [goalResponse, portfolioResponse] = await Promise.all([
      fetch("/api/goal", { cache: "no-store" }),
      fetch("/api/portfolio", { cache: "no-store" }),
    ]);
    if (goalResponse.ok) setGoal(((await goalResponse.json()) as { goal: Goal | null }).goal);
    if (portfolioResponse.ok) setCurrent(((await portfolioResponse.json()) as { total: number }).total);
  }, []);

  const loadAiRecommendation = useCallback(async (forceGenerate = false) => {
    setAiLoading(true);
    setAiError("");
    try {
      if (!forceGenerate) {
        const historyResponse = await fetch("/api/goal/ai-recommendation", { cache: "no-store" });
        if (historyResponse.ok) {
          const historyResult = await historyResponse.json() as { history: { recommendation: Recommendation; assetNames: string[]; createdAt: string } | null };
          if (historyResult.history) {
            setAiAvailable(true);
            setAssetNames(historyResult.history.assetNames);
            setRecommendation(historyResult.history.recommendation);
            setAiGeneratedAt(historyResult.history.createdAt);
            return;
          }
        }
      }
      const response = await fetch("/api/goal/ai-recommendation", { method: "POST", cache: "no-store" });
      const result = await response.json() as { available?: boolean; error?: string; assetNames?: string[]; createdAt?: string; recommendation?: Recommendation };
      setAiAvailable(result.available ?? false);
      if (!response.ok || !result.recommendation) throw new Error(result.error || "AI 추천을 불러오지 못했습니다.");
      setAssetNames(result.assetNames ?? []);
      setRecommendation(result.recommendation);
      setAiGeneratedAt(result.createdAt ?? null);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 추천을 불러오지 못했습니다.");
    } finally { setAiLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (!goal) return; const timer = window.setTimeout(() => void loadAiRecommendation(), 0); return () => window.clearTimeout(timer); }, [goal, loadAiRecommendation]);

  const plan = useMemo(() => {
    if (!goal) return null;
    const remaining = Math.max(0, goal.targetAmount - current);
    const progress = goal.targetAmount > 0 ? Math.min(100, current / goal.targetAmount * 100) : 0;
    const months = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
    const monthlyRate = 0.05 / 12;
    let projectedMonths = 0, projected = current;
    while (projected < goal.targetAmount && projectedMonths < 1200) { projected = projected * (1 + monthlyRate) + goal.monthlyContribution; projectedMonths += 1; }
    return { remaining, progress, months, projectedMonths };
  }, [current, goal]);

  return <div className="app-shell"><AppSidebar onChanged={() => void load()} /><main className="main sub-page">
    <header className="topbar"><div><p className="eyebrow">FINANCIAL GOAL</p><h1>목표 자산 플랜</h1></div></header>
    {!goal ? <section className="page-card goal-empty"><strong>설정된 목표 금액이 없습니다.</strong><p>좌측 설정의 목표 설정 탭에서 목표 금액과 월 투자 가능 금액을 입력해 주세요.</p></section> : <>
      <section className="goal-hero"><div><small>나의 목표</small><h2 className="goal-money">{money(goal.targetAmount)}</h2><p>현재 <b className="goal-money">{money(current)}</b> · 목표까지 <b className="goal-money">{money(plan?.remaining ?? 0)}</b></p></div><div className="goal-ring" style={{ "--progress": `${plan?.progress ?? 0}%` } as React.CSSProperties}><strong>{(plan?.progress ?? 0).toFixed(1)}%</strong><small>달성</small></div></section>
      <section className="summary-cards"><article><small>매월 투자 계획</small><strong className="goal-money">{money(goal.monthlyContribution)}</strong></article><article><small>수익률 없이 예상</small><strong>{plan?.months == null ? "계산 불가" : `${plan.months}개월`}</strong></article><article><small>연 5% 가정 시</small><strong>{goal.monthlyContribution > 0 ? `${plan?.projectedMonths}개월` : "계산 불가"}</strong></article></section>
      <section className="page-card advice-card"><h2>목표에 가까워지는 방법</h2><p>현재 계획대로라면 매월 <b>{money(goal.monthlyContribution)}</b>을 투자할 때 연 5% 수익률 가정으로 약 <b>{plan?.projectedMonths}개월</b>이 필요합니다.</p><ul><li>월 투자 금액을 자동이체로 먼저 확보하세요.</li><li>생활비 3~6개월분은 투자 자산과 분리해 비상금으로 유지하세요.</li><li>특정 종목 비중이 지나치게 높다면 정기적으로 리밸런싱하세요.</li><li>6개월마다 목표와 납입액을 다시 점검하세요.</li></ul><small>연 5%는 계획 비교를 위한 단순 가정이며 투자 권유나 수익 보장이 아닙니다.</small></section>
      <section className="page-card ai-goal-card">
        <div className="section-title"><div><span>AI 맞춤 목표 방향</span><small>{aiGeneratedAt ? `오늘 마지막 분석 · ${new Date(aiGeneratedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : "등록 자산과 목표를 함께 분석합니다."}</small></div>{aiAvailable !== false && <button className="text-button" disabled={aiLoading} onClick={() => void loadAiRecommendation(true)}>{aiLoading ? "분석 중..." : "다시 분석"}</button>}</div>
        {aiLoading && !recommendation ? <div className="ai-loading">등록 자산의 구성과 목표 달성 계획을 분석하고 있습니다.</div> : null}
        {recommendation ? <div className="ai-recommendation"><h2><HighlightedText text={recommendation.headline} assetNames={assetNames} /></h2><p><HighlightedText text={recommendation.direction} assetNames={assetNames} /></p><h3>추천 실행 계획</h3><ol>{recommendation.actions.map((action) => <li key={action}><HighlightedText text={action} assetNames={assetNames} /></li>)}</ol><div className="ai-cautions"><strong>꼭 확인하세요</strong><ul>{recommendation.cautions.map((caution) => <li key={caution}><HighlightedText text={caution} assetNames={assetNames} /></li>)}</ul></div></div> : null}
        {aiError && !recommendation ? <div className={aiAvailable === false ? "ai-unavailable" : "asset-settings-error"}>{aiError}</div> : null}
      </section>
    </>}
  </main></div>;
}
