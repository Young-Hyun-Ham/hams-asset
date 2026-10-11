"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { useFeedback } from "@/components/FeedbackProvider";
import StockCombobox from "@/components/StockCombobox";
import type { AssetProfileSummary } from "@/lib/asset-spec";
import "./transactions.css";

type TransactionType =
  "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "interest";
type Transaction = {
  id: string;
  accountId: string;
  accountName: string;
  type: TransactionType;
  occurredAt: string;
  assetName: string;
  symbol: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  fee: number;
  currency: "KRW" | "USD";
  memo: string;
};
type AccountOption = {
  id: string;
  name: string;
  assetType: "bank" | "brokerage";
  currency: "KRW" | "USD";
};

const labels: Record<TransactionType, string> = {
  buy: "매수",
  sell: "매도",
  deposit: "입금",
  withdrawal: "출금",
  dividend: "배당",
  interest: "이자",
};
const bankTypes: TransactionType[] = ["deposit", "withdrawal", "interest"];
const brokerageTypes: TransactionType[] = ["buy", "sell", "dividend"];
const money = (value: number, currency: "KRW" | "USD") =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(value);

export default function TransactionsPage() {
  const { snackbar } = useFeedback();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<AssetProfileSummary[]>([]);
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("deposit");
  const [symbol, setSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");

  const load = useCallback(async () => {
    const [txResponse, assetResponse] = await Promise.all([
      fetch("/api/transactions", { cache: "no-store" }),
      fetch("/api/assets", { cache: "no-store" }),
    ]);
    if (txResponse.ok)
      setTransactions(
        ((await txResponse.json()) as { transactions: Transaction[] })
          .transactions,
      );
    if (assetResponse.ok)
      setProfiles(
        ((await assetResponse.json()) as { assets: AssetProfileSummary[] })
          .assets,
      );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const accounts = useMemo<AccountOption[]>(
    () =>
      profiles.flatMap((profile) =>
        profile.accounts.map((account) => ({
          id: account.id,
          name: `${profile.provider.name} · ${account.displayName}`,
          assetType: profile.assetType,
          currency: account.currency,
        })),
      ),
    [profiles],
  );
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter((item) => item.type === filter);

  const changeAccount = (nextId: string) => {
    const account = accounts.find((item) => item.id === nextId);
    setAccountId(nextId);
    setTransactionType(account?.assetType === "brokerage" ? "buy" : "deposit");
    setCurrency(account?.currency ?? "KRW");
    setSymbol("");
    setAssetName("");
  };

  const resetDraft = () => {
    setAccountId("");
    setTransactionType("deposit");
    setSymbol("");
    setAssetName("");
    setCurrency("KRW");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!selectedAccount) {
      snackbar({
        message: "거래를 기록할 계좌를 선택해 주세요.",
        tone: "error",
      });
      return;
    }
    if (selectedAccount.assetType === "brokerage" && (!symbol || !assetName)) {
      snackbar({
        message: "종목 코드 또는 종목명을 검색해 종목을 선택해 주세요.",
        tone: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          accountName: selectedAccount.name,
          type: transactionType,
          occurredAt: form.get("occurredAt"),
          assetName: selectedAccount.assetType === "brokerage" ? assetName : "",
          symbol: selectedAccount.assetType === "brokerage" ? symbol : "",
          quantity:
            selectedAccount.assetType === "brokerage"
              ? form.get("quantity")
              : 0,
          unitPrice:
            selectedAccount.assetType === "brokerage"
              ? form.get("unitPrice")
              : 0,
          amount: form.get("amount"),
          fee: selectedAccount.assetType === "brokerage" ? form.get("fee") : 0,
          currency,
          memo: form.get("memo"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "거래를 저장하지 못했습니다.");
      formElement.reset();
      resetDraft();
      setFormOpen(false);
      await load();
      snackbar({ message: "거래 내역을 저장했습니다.", tone: "success" });
    } catch (error) {
      snackbar({
        message:
          error instanceof Error
            ? error.message
            : "거래를 저장하지 못했습니다.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell transactions-page">
      <AppSidebar onChanged={() => void load()} />
      <main className="main sub-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">TRANSACTIONS</p>
            <h1>거래 내역</h1>
          </div>
          <button
            className="add-button"
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? "입력 닫기" : "+ 거래 기록"}
          </button>
        </header>

        {formOpen ? (
          <section className="page-card transaction-form-card">
            <h2>새 거래 기록</h2>
            <form className="transaction-form" onSubmit={save}>
              <label>
                <span>계좌</span>
                <select
                  value={accountId}
                  onChange={(event) => changeAccount(event.target.value)}
                  required
                >
                  <option value="">은행 또는 증권 계좌 선택</option>
                  <optgroup label="은행 계좌">
                    {accounts
                      .filter((account) => account.assetType === "bank")
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="증권 계좌">
                    {accounts
                      .filter((account) => account.assetType === "brokerage")
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              <label>
                <span>거래 유형</span>
                <select
                  value={transactionType}
                  onChange={(event) =>
                    setTransactionType(event.target.value as TransactionType)
                  }
                  disabled={!selectedAccount}
                >
                  {(selectedAccount?.assetType === "brokerage"
                    ? brokerageTypes
                    : bankTypes
                  ).map((type) => (
                    <option key={type} value={type}>
                      {labels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>거래일</span>
                <input
                  type="date"
                  name="occurredAt"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>

              {!selectedAccount ? (
                <div className="transaction-account-guide wide">
                  계좌를 선택하면 계좌 유형에 맞는 입력 항목이 표시됩니다.
                </div>
              ) : null}

              {selectedAccount?.assetType === "brokerage" ? (
                <>
                  <div className="wide transaction-stock-field">
                    <StockCombobox
                      symbol={symbol}
                      name={assetName}
                      onDraftChange={(field, value) =>
                        field === "symbol"
                          ? setSymbol(value)
                          : setAssetName(value)
                      }
                      onSelect={(stock) => {
                        setSymbol(stock.symbol);
                        setAssetName(stock.name);
                        setCurrency(stock.currency);
                      }}
                    />
                    <small>
                      종목 코드·종목명·한글 초성으로 검색할 수 있으며 Enter를
                      누르면 첫 번째 종목이 선택됩니다.
                    </small>
                  </div>
                  <label>
                    <span>수량</span>
                    <input
                      name="quantity"
                      inputMode="decimal"
                      placeholder="10"
                      required
                    />
                  </label>
                  <label>
                    <span>단가</span>
                    <input
                      name="unitPrice"
                      inputMode="decimal"
                      placeholder="70000"
                      required
                    />
                  </label>
                  <label>
                    <span>거래 금액</span>
                    <input
                      name="amount"
                      inputMode="decimal"
                      placeholder="700000"
                      required
                    />
                  </label>
                  <label>
                    <span>수수료</span>
                    <input name="fee" inputMode="decimal" placeholder="0" />
                  </label>
                  <label>
                    <span>통화</span>
                    <select
                      value={currency}
                      onChange={(event) =>
                        setCurrency(event.target.value as "KRW" | "USD")
                      }
                    >
                      <option>KRW</option>
                      <option>USD</option>
                    </select>
                  </label>
                </>
              ) : null}

              {selectedAccount?.assetType === "bank" ? (
                <>
                  <div className="transaction-kind-card wide">
                    <strong>{labels[transactionType]} 거래</strong>
                    <span>
                      은행 계좌는 종목 정보 없이 금액과 메모만 기록합니다.
                    </span>
                  </div>
                  <label>
                    <span>거래 금액</span>
                    <input
                      name="amount"
                      inputMode="decimal"
                      placeholder="1000000"
                      required
                    />
                  </label>
                  <label>
                    <span>통화</span>
                    <select
                      value={currency}
                      onChange={(event) =>
                        setCurrency(event.target.value as "KRW" | "USD")
                      }
                    >
                      <option>KRW</option>
                      <option>USD</option>
                    </select>
                  </label>
                </>
              ) : null}

              {selectedAccount ? (
                <label className="wide">
                  <span>메모</span>
                  <input name="memo" maxLength={200} placeholder="선택 입력" />
                </label>
              ) : null}
              {selectedAccount ? (
                <button className="asset-save wide" disabled={saving}>
                  {saving ? "암호화 저장 중..." : "거래 저장"}
                </button>
              ) : null}
            </form>
          </section>
        ) : null}

        <section className="page-card">
          <div className="section-title">
            <div>
              <span>전체 거래</span>
              <small>총 {transactions.length}건</small>
            </div>
            <select
              className="transaction-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">전체</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="transaction-ledger">
            {filtered.map((item) => (
              <article key={item.id}>
                <time>{item.occurredAt}</time>
                <i className={`ledger-type ${item.type}`}>
                  {labels[item.type]}
                </i>
                <div>
                  <b>{item.assetName || labels[item.type]}</b>
                  <small>
                    {item.accountName}
                    {item.symbol ? ` · ${item.symbol}` : ""}
                    {item.memo ? ` · ${item.memo}` : ""}
                  </small>
                </div>
                <strong
                  className={
                    ["sell", "deposit", "dividend", "interest"].includes(
                      item.type,
                    )
                      ? "positive"
                      : ""
                  }
                >
                  {["sell", "deposit", "dividend", "interest"].includes(
                    item.type,
                  )
                    ? "+"
                    : "-"}
                  {money(item.amount, item.currency)}
                </strong>
              </article>
            ))}
            {filtered.length === 0 ? (
              <div className="empty">기록된 거래가 없습니다.</div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
