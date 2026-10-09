"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssetProfileSummary } from "@/lib/asset-spec";
import { BANKS, BROKERAGES } from "@/lib/financial-institutions";
import { useFeedback } from "./FeedbackProvider";
import InstitutionCombobox from "./InstitutionCombobox";
import StockCombobox from "./StockCombobox";
import "./AssetSettingsDrawer.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onAssetsChanged?: () => void;
};

type HoldingDraft = {
  key: string;
  symbol: string;
  name: string;
  market: "KRX" | "KOSDAQ" | "NYSE" | "NASDAQ" | "OTHER";
  assetClass: "stock" | "etf";
  currency: "KRW" | "USD";
  quantity: string;
  averagePrice: string;
};

const newHolding = (key: string): HoldingDraft => ({
  key,
  symbol: "",
  name: "",
  market: "KRX",
  assetClass: "stock",
  currency: "KRW",
  quantity: "",
  averagePrice: "",
});

const money = (value: string, currency: string) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${value} ${currency}`;
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
};

const koreanMoney = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  let amount = Number(digits);
  if (amount === 0) return "0원";
  const parts: string[] = [];
  const units = [
    { value: 1_000_000_000_000, label: "조" },
    { value: 100_000_000, label: "억" },
    { value: 10_000, label: "만" },
  ];
  for (const unit of units) {
    const count = Math.floor(amount / unit.value);
    if (count > 0) {
      parts.push(`${count.toLocaleString("ko-KR")}${unit.label}`);
      amount %= unit.value;
    }
  }
  if (amount > 0) parts.push(`${amount.toLocaleString("ko-KR")}원`);
  else parts[parts.length - 1] += "원";
  return parts.join(" ");
};

export default function AssetSettingsDrawer({ open, onClose, onAssetsChanged }: Props) {
  const { confirm, snackbar } = useFeedback();
  const [tab, setTab] = useState<"list" | "bank" | "brokerage" | "goal">("list");
  const [assets, setAssets] = useState<AssetProfileSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [holdings, setHoldings] = useState<HoldingDraft[]>([newHolding("initial")]);
  const [targetAmount, setTargetAmount] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");

  const loadGoal = useCallback(async () => {
    const response = await fetch("/api/goal", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { goal: { targetAmount: number; monthlyContribution: number } | null };
    if (result.goal) {
      setTargetAmount(String(result.goal.targetAmount));
      setMonthlyContribution(String(result.goal.monthlyContribution));
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assets", { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error("등록된 자산을 불러오지 못했습니다.");
      const result = await response.json() as { assets: AssetProfileSummary[] };
      setAssets(result.assets);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "자산을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) queueMicrotask(() => { void loadAssets(); void loadGoal(); });
  }, [open, loadAssets, loadGoal]);

  const saveGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/goal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetAmount, monthlyContribution }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "목표를 저장하지 못했습니다.");
      snackbar({ message: "자산 목표를 저장했습니다.", tone: "success" });
      onAssetsChanged?.();
    } catch (reason) {
      snackbar({ message: reason instanceof Error ? reason.message : "목표를 저장하지 못했습니다.", tone: "error" });
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, onClose]);

  if (!open) return null;

  const save = async (event: React.FormEvent<HTMLFormElement>, assetType: "bank" | "brokerage") => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    const form = new FormData(formElement);
    const body = assetType === "bank"
      ? {
          assetType,
          providerName: form.get("providerName"),
          displayName: form.get("displayName"),
          accountLastFour: form.get("accountLastFour"),
          accountType: form.get("accountType"),
          currency: form.get("currency"),
          balance: form.get("balance"),
        }
      : {
          assetType,
          providerName: form.get("providerName"),
          displayName: form.get("displayName"),
          accountLastFour: form.get("accountLastFour"),
          accountType: form.get("accountType"),
          currency: "KRW",
          holdings: holdings.map((holding) => ({
            symbol: holding.symbol,
            name: holding.name,
            market: holding.market,
            assetClass: holding.assetClass,
            currency: holding.currency,
            quantity: holding.quantity,
            averagePrice: holding.averagePrice,
          })),
        };

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "자산을 저장하지 못했습니다.");
      formElement.reset();
      setHoldings([newHolding("initial")]);
      await loadAssets();
      onAssetsChanged?.();
      setTab("list");
      snackbar({
        message: assetType === "bank" ? "은행 자산을 저장했습니다." : "증권 자산을 저장했습니다.",
        tone: "success",
      });
    } catch (reason) {
      const message = reason instanceof Error && /[가-힣]/.test(reason.message)
        ? reason.message
        : "자산 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      setError(message);
      snackbar({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const accepted = await confirm({
      title: "자산 삭제",
      message: "이 자산을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
    });
    if (!accepted) return;
    setError("");
    const response = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const message = "자산을 삭제하지 못했습니다.";
      setError(message);
      snackbar({ message, tone: "error" });
      return;
    }
    setAssets((current) => current.filter((asset) => asset.id !== id));
    onAssetsChanged?.();
    snackbar({ message: "자산을 삭제했습니다.", tone: "success" });
  };

  return (
    <div className="asset-settings-backdrop" onMouseDown={onClose}>
      <section className="asset-settings" onMouseDown={(event) => event.stopPropagation()} aria-label="자산 설정">
        <header className="asset-settings-header">
          <div>
            <span>ASSET SETTINGS</span>
            <h2>자산 설정</h2>
            <p>직접 등록한 정보는 암호화되어 사용자별로 저장됩니다.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="자산 설정 닫기">×</button>
        </header>

        <nav className="asset-settings-tabs" aria-label="자산 설정 메뉴">
          <button type="button" className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>등록 자산</button>
          <button type="button" className={tab === "bank" ? "active" : ""} onClick={() => setTab("bank")}>은행 등록</button>
          <button type="button" className={tab === "brokerage" ? "active" : ""} onClick={() => setTab("brokerage")}>주식 등록</button>
          <button type="button" className={tab === "goal" ? "active" : ""} onClick={() => setTab("goal")}>목표 설정</button>
        </nav>

        {error ? <div className="asset-settings-error" role="alert">{error}</div> : null}

        <div className="asset-settings-body">
          {tab === "list" ? (
            <div className="registered-assets">
              {loading ? <div className="asset-settings-empty">자산을 불러오는 중입니다.</div> : null}
              {!loading && assets.length === 0 ? (
                <div className="asset-settings-empty">
                  <strong>아직 등록한 자산이 없습니다.</strong>
                  <p>은행 계좌 또는 증권계좌를 직접 등록해 주세요.</p>
                </div>
              ) : null}
              {assets.map((asset) => {
                const account = asset.accounts[0];
                const balance = account?.balances[0];
                return (
                  <article className="registered-asset" key={asset.id}>
                    <span className={`registered-asset-icon ${asset.assetType}`}>{asset.assetType === "bank" ? "B" : "S"}</span>
                    <div>
                      <small>{asset.assetType === "bank" ? "은행" : "증권"} · 수동 등록</small>
                      <strong>{asset.provider.name}</strong>
                      <p>{account?.displayName} · {account?.accountNumberMasked}</p>
                      {balance ? <b>{money(balance.marketValue, balance.currency)}</b> : <b>보유 종목 {account?.holdings.length ?? 0}개</b>}
                    </div>
                    <button type="button" onClick={() => void remove(asset.id)}>삭제</button>
                  </article>
                );
              })}
            </div>
          ) : null}

          {tab === "bank" ? (
            <form className="asset-form" onSubmit={(event) => void save(event, "bank")}>
              <div className="asset-form-intro"><strong>은행 계좌</strong><p>예금과 현금성 자산을 등록합니다.</p></div>
              <InstitutionCombobox name="providerName" label="은행명" placeholder="은행을 검색하거나 선택하세요" options={BANKS} />
              <label><span>계좌 별칭</span><input name="displayName" placeholder="예: 생활비 통장" required maxLength={80} /></label>
              <div className="asset-form-grid">
                <label><span>계좌 끝 4자리</span><input name="accountLastFour" inputMode="numeric" pattern="[0-9]{0,4}" maxLength={4} placeholder="1234" /></label>
                <label><span>계좌 유형</span><select name="accountType"><option value="checking">입출금</option><option value="savings">적금</option><option value="deposit">예금</option></select></label>
              </div>
              <div className="asset-form-grid">
                <label><span>통화</span><select name="currency"><option value="KRW">KRW</option><option value="USD">USD</option></select></label>
                <label><span>현재 잔액</span><input name="balance" inputMode="decimal" placeholder="1000000" required /></label>
              </div>
              <button className="asset-save" type="submit" disabled={saving}>{saving ? "암호화 저장 중…" : "은행 자산 저장"}</button>
            </form>
          ) : null}

          {tab === "brokerage" ? (
            <form className="asset-form" onSubmit={(event) => void save(event, "brokerage")}>
              <div className="asset-form-intro"><strong>증권계좌</strong><p>국내·해외 주식과 ETF를 등록합니다.</p></div>
              <InstitutionCombobox name="providerName" label="증권사명" placeholder="증권사를 검색하거나 선택하세요" options={BROKERAGES} />
              <label><span>계좌 별칭</span><input name="displayName" placeholder="예: 주식 투자 계좌" required maxLength={80} /></label>
              <div className="asset-form-grid">
                <label><span>계좌 끝 4자리</span><input name="accountLastFour" inputMode="numeric" pattern="[0-9]{0,4}" maxLength={4} placeholder="1234" /></label>
                <label><span>계좌 유형</span><select name="accountType"><option value="securities">종합매매</option><option value="isa">ISA</option><option value="pension">연금</option><option value="cma">CMA</option></select></label>
              </div>

              <div className="holding-editor">
                <div className="holding-editor-title"><strong>보유 종목</strong><button type="button" onClick={() => setHoldings((current) => [...current, newHolding(crypto.randomUUID())])}>+ 종목 추가</button></div>
                {holdings.map((holding, index) => (
                  <fieldset key={holding.key}>
                    <legend>종목 {index + 1}</legend>
                    {holdings.length > 1 ? <button className="holding-remove" type="button" onClick={() => setHoldings((current) => current.filter((item) => item.key !== holding.key))}>삭제</button> : null}
                    <StockCombobox
                      symbol={holding.symbol}
                      name={holding.name}
                      onDraftChange={(field, value) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, [field]: value } : item))}
                      onSelect={(stock) => setHoldings((current) => current.map((item) => item.key === holding.key ? {
                        ...item,
                        symbol: stock.symbol,
                        name: stock.name,
                        market: stock.market,
                        currency: stock.currency,
                        assetClass: stock.assetClass,
                      } : item))}
                    />
                    <div className="asset-form-grid three">
                      <label><span>시장</span><select value={holding.market} onChange={(event) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, market: event.target.value as HoldingDraft["market"] } : item))}><option>KRX</option><option>KOSDAQ</option><option>NYSE</option><option>NASDAQ</option><option>OTHER</option></select></label>
                      <label><span>자산 유형</span><select value={holding.assetClass} onChange={(event) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, assetClass: event.target.value as HoldingDraft["assetClass"] } : item))}><option value="stock">주식</option><option value="etf">ETF</option></select></label>
                      <label><span>통화</span><select value={holding.currency} onChange={(event) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, currency: event.target.value as HoldingDraft["currency"] } : item))}><option>KRW</option><option>USD</option></select></label>
                    </div>
                    <div className="asset-form-grid">
                      <label><span>수량</span><input inputMode="decimal" value={holding.quantity} onChange={(event) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, quantity: event.target.value } : item))} placeholder="10" required /></label>
                      <label><span>평균 매입가</span><input inputMode="decimal" value={holding.averagePrice} onChange={(event) => setHoldings((current) => current.map((item) => item.key === holding.key ? { ...item, averagePrice: event.target.value } : item))} placeholder="75000" required /></label>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button className="asset-save" type="submit" disabled={saving}>{saving ? "암호화 저장 중…" : "증권 자산 저장"}</button>
            </form>
          ) : null}

          {tab === "goal" ? (
            <form className="asset-form" onSubmit={saveGoal}>
              <div className="asset-form-intro"><strong>자산 목표</strong><p>목표 금액과 매월 투자할 수 있는 금액을 설정해 주세요.</p></div>
              <label><span>목표 금액</span><input value={targetAmount} onChange={(event) => setTargetAmount(event.target.value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" placeholder="100000000" required />{targetAmount ? <small className="korean-money">{Number(targetAmount).toLocaleString("ko-KR")}원 · {koreanMoney(targetAmount)}</small> : null}</label>
              <label><span>월 투자 가능 금액</span><input value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" placeholder="1000000" required />{monthlyContribution ? <small className="korean-money">{Number(monthlyContribution).toLocaleString("ko-KR")}원 · {koreanMoney(monthlyContribution)}</small> : null}</label>
              <button className="asset-save" type="submit" disabled={saving}>{saving ? "암호화 저장 중..." : "목표 저장"}</button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
