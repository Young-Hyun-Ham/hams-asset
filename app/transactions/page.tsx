"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { useFeedback } from "@/components/FeedbackProvider";
import type { AssetProfileSummary } from "@/lib/asset-spec";
import "./transactions.css";

type Transaction = { id: string; accountId: string; accountName: string; type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "interest"; occurredAt: string; assetName: string; symbol: string; quantity: number; unitPrice: number; amount: number; fee: number; currency: "KRW" | "USD"; memo: string };
const labels = { buy: "매수", sell: "매도", deposit: "입금", withdrawal: "출금", dividend: "배당", interest: "이자" };
const money = (value: number, currency: "KRW" | "USD") => new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(value);

export default function TransactionsPage() {
  const { snackbar } = useFeedback();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<AssetProfileSummary[]>([]);
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [txResponse, assetResponse] = await Promise.all([fetch("/api/transactions", { cache: "no-store" }), fetch("/api/assets", { cache: "no-store" })]);
    if (txResponse.ok) setTransactions(((await txResponse.json()) as { transactions: Transaction[] }).transactions);
    if (assetResponse.ok) setProfiles(((await assetResponse.json()) as { assets: AssetProfileSummary[] }).assets);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const accounts = useMemo(() => profiles.flatMap((profile) => profile.accounts.map((account) => ({ id: account.id, name: `${profile.provider.name} · ${account.displayName}` }))), [profiles]);
  const filtered = filter === "all" ? transactions : transactions.filter((item) => item.type === filter);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement); const account = accounts.find((item) => item.id === form.get("accountId"));
    try {
      const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account?.id, accountName: account?.name, type: form.get("type"), occurredAt: form.get("occurredAt"), assetName: form.get("assetName"), symbol: form.get("symbol"), quantity: form.get("quantity"), unitPrice: form.get("unitPrice"), amount: form.get("amount"), fee: form.get("fee"), currency: form.get("currency"), memo: form.get("memo") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "거래를 저장하지 못했습니다.");
      formElement.reset(); setFormOpen(false); await load(); snackbar({ message: "거래 내역을 저장했습니다.", tone: "success" });
    } catch (error) { snackbar({ message: error instanceof Error ? error.message : "거래를 저장하지 못했습니다.", tone: "error" }); }
    finally { setSaving(false); }
  };
  return <div className="app-shell transactions-page"><AppSidebar onChanged={() => void load()} /><main className="main sub-page">
    <header className="topbar"><div><p className="eyebrow">TRANSACTIONS</p><h1>거래 내역</h1></div><button className="add-button" onClick={() => setFormOpen((value) => !value)}>{formOpen ? "입력 닫기" : "+ 거래 기록"}</button></header>
    {formOpen && <section className="page-card transaction-form-card"><h2>새 거래 기록</h2><form className="transaction-form" onSubmit={save}><label><span>계좌</span><select name="accountId" required><option value="">선택</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>거래 유형</span><select name="type"><option value="buy">매수</option><option value="sell">매도</option><option value="deposit">입금</option><option value="withdrawal">출금</option><option value="dividend">배당</option><option value="interest">이자</option></select></label><label><span>거래일</span><input type="date" name="occurredAt" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label><span>종목명</span><input name="assetName" placeholder="선택 입력" /></label><label><span>종목 코드</span><input name="symbol" placeholder="선택 입력" /></label><label><span>수량</span><input name="quantity" inputMode="decimal" placeholder="0" /></label><label><span>단가</span><input name="unitPrice" inputMode="decimal" placeholder="0" /></label><label><span>거래 금액</span><input name="amount" inputMode="decimal" required /></label><label><span>수수료</span><input name="fee" inputMode="decimal" placeholder="0" /></label><label><span>통화</span><select name="currency"><option>KRW</option><option>USD</option></select></label><label className="wide"><span>메모</span><input name="memo" maxLength={200} /></label><button className="asset-save wide" disabled={saving}>{saving ? "암호화 저장 중..." : "거래 저장"}</button></form></section>}
    <section className="page-card"><div className="section-title"><div><span>전체 거래</span><small>총 {transactions.length}건</small></div><select className="transaction-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">전체</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="transaction-ledger">{filtered.map((item) => <article key={item.id}><time>{item.occurredAt}</time><i className={`ledger-type ${item.type}`}>{labels[item.type]}</i><div><b>{item.assetName || labels[item.type]}</b><small>{item.accountName}{item.symbol ? ` · ${item.symbol}` : ""}{item.memo ? ` · ${item.memo}` : ""}</small></div><strong className={["sell", "deposit", "dividend", "interest"].includes(item.type) ? "positive" : ""}>{["sell", "deposit", "dividend", "interest"].includes(item.type) ? "+" : "-"}{money(item.amount, item.currency)}</strong></article>)}{filtered.length === 0 && <div className="empty">기록된 거래가 없습니다.</div>}</div></section>
  </main></div>;
}
