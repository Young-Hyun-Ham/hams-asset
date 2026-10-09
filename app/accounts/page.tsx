"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import type { AssetProfileSummary } from "@/lib/asset-spec";
import "./accounts.css";

type PortfolioAsset = { id: string; category: string; value: number; cost: number };
const money = (value: number, currency = "KRW") => new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(value);

export default function AccountsPage() {
  const [profiles, setProfiles] = useState<AssetProfileSummary[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsResponse, portfolioResponse] = await Promise.all([fetch("/api/assets", { cache: "no-store" }), fetch("/api/portfolio", { cache: "no-store" })]);
      if (assetsResponse.ok) setProfiles(((await assetsResponse.json()) as { assets: AssetProfileSummary[] }).assets);
      if (portfolioResponse.ok) setPortfolioAssets(((await portfolioResponse.json()) as { assets: PortfolioAsset[] }).assets);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const totals = useMemo(() => profiles.reduce((result, profile) => { result[profile.assetType] += 1; return result; }, { bank: 0, brokerage: 0 }), [profiles]);
  return <div className="app-shell accounts-page"><AppSidebar onChanged={() => void load()} /><main className="main sub-page">
    <header className="topbar"><div><p className="eyebrow">ACCOUNTS</p><h1>내 계좌</h1></div><button className="add-button" disabled={loading} onClick={() => void load()}>{loading ? "조회 중..." : "새로고침"}</button></header>
    <section className="summary-cards"><article><small>연결 계좌</small><strong>{profiles.length}개</strong></article><article><small>은행 계좌</small><strong>{totals.bank}개</strong></article><article><small>증권 계좌</small><strong>{totals.brokerage}개</strong></article></section>
    <section className="account-grid">{profiles.map((profile) => {
      const account = profile.accounts[0];
      const values = portfolioAssets.filter((asset) => asset.category.startsWith(profile.provider.name));
      const currentValue = values.reduce((sum, asset) => sum + asset.value, 0);
      return <article className="account-card" key={profile.id}><header><span className={`registered-asset-icon ${profile.assetType}`}>{profile.assetType === "bank" ? "B" : "S"}</span><div><small>{profile.assetType === "bank" ? "은행" : "증권"}</small><h2>{profile.provider.name}</h2><p>{account?.displayName} · {account?.accountNumberMasked}</p></div><i className="account-status">연결됨</i></header><div className="account-value"><small>{profile.assetType === "bank" ? "현재 잔액" : "현재 평가 금액"}</small><strong>{profile.assetType === "bank" ? money(Number(account?.balances[0]?.marketValue ?? 0), account?.balances[0]?.currency) : money(currentValue)}</strong></div>{profile.assetType === "brokerage" ? <div className="account-holdings"><span>보유 종목 <b>{account?.holdings.length ?? 0}개</b></span>{account?.holdings.slice(0, 4).map((holding) => <span key={holding.id}><b>{holding.symbol}</b>{holding.name}</span>)}</div> : <div className="account-holdings"><span>계좌 유형 <b>{account?.accountType}</b></span><span>통화 <b>{account?.currency}</b></span></div>}</article>;
    })}{!loading && profiles.length === 0 && <div className="page-card goal-empty"><strong>등록된 계좌가 없습니다.</strong><p>설정에서 은행 또는 증권 계좌를 등록해 주세요.</p></div>}</section>
  </main></div>;
}
