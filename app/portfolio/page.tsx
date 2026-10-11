"use client";

import { useCallback, useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";

type Asset = {
  id: string;
  ticker: string;
  name: string;
  category: string;
  assetType: "bank" | "brokerage";
  value: number;
  cost: number;
  returnRate: number;
  dailyRate: number;
  weight: number;
  quoteSource: string;
};
type Portfolio = {
  total: number;
  gain: number;
  returnRate: number;
  assets: Asset[];
  allocation: { brokerage: number; bank: number };
  updatedAt: string;
};
const money = (value: number) =>
  `${Math.round(value).toLocaleString("ko-KR")}원`;

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });
      if (response.ok) setData((await response.json()) as Portfolio);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <div className="app-shell">
      <AppSidebar onChanged={() => void load()} />
      <main className="main sub-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">PORTFOLIO</p>
            <h1>내 포트폴리오</h1>
          </div>
          <button
            className="add-button"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        </header>
        <section className="summary-cards">
          <article>
            <small>총 평가 금액</small>
            <strong>{money(data?.total ?? 0)}</strong>
          </article>
          <article>
            <small>총 평가 손익</small>
            <strong className={(data?.gain ?? 0) < 0 ? "negative" : "positive"}>
              {money(data?.gain ?? 0)}
            </strong>
          </article>
          <article>
            <small>전체 수익률</small>
            <strong
              className={(data?.returnRate ?? 0) < 0 ? "negative" : "positive"}
            >
              {(data?.returnRate ?? 0).toFixed(2)}%
            </strong>
          </article>
        </section>
        <section className="page-card">
          <div className="section-title">
            <div>
              <span>자산별 현황</span>
              <small>현재 평가금액과 매입금액 비교</small>
            </div>
          </div>
          <div className="portfolio-table">
            <div className="portfolio-table-head">
              <span>자산</span>
              <span>매입 금액</span>
              <span>평가 금액</span>
              <span>손익</span>
              <span>비중</span>
            </div>
            {data?.assets.map((asset) => (
              <div className="portfolio-table-row" key={asset.id}>
                <span>
                  <b>{asset.name}</b>
                  <small>
                    {asset.ticker} · {asset.category}
                  </small>
                </span>
                <span>{money(asset.cost)}</span>
                <span>{money(asset.value)}</span>
                <span
                  className={asset.returnRate < 0 ? "negative" : "positive"}
                >
                  {asset.returnRate.toFixed(2)}%
                </span>
                <span>{asset.weight.toFixed(1)}%</span>
              </div>
            ))}
            {!loading && !data?.assets.length && (
              <div className="empty">등록된 자산이 없습니다.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
