"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { StockInstrument } from "@/lib/stock-catalog";

type SearchResult = {
  items: StockInstrument[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  error?: string;
};

type Props = {
  symbol: string;
  name: string;
  onDraftChange: (field: "symbol" | "name", value: string) => void;
  onSelect: (stock: StockInstrument) => void;
};

export default function StockCombobox({ symbol, name, onDraftChange, onSelect }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult>({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [activeIndex, setActiveIndex] = useState(0);
  const queryRef = useRef("");
  const completedQueryRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  const search = async (query: string, page = 1, selectFirst = false) => {
    queryRef.current = query;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setOpen(true);
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}&page=${page}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json() as SearchResult;
      if (!response.ok) throw new Error(data.error || "종목을 검색하지 못했습니다.");
      completedQueryRef.current = query;
      setResult(data);
      setActiveIndex(0);
      if (selectFirst && data.items[0]) {
        onSelect(data.items[0]);
        setOpen(false);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setResult({
        items: [], page: 1, pageSize: 50, total: 0, totalPages: 1,
        error: error instanceof Error && /[가-힣]/.test(error.message)
          ? error.message
          : "종목을 검색하지 못했습니다.",
      });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const schedule = (query: string) => {
    queryRef.current = query;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void search(query, 1), 250);
  };

  const choose = (stock: StockInstrument) => {
    onSelect(stock);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => result.items.length ? Math.min(current + 1, result.items.length - 1) : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && completedQueryRef.current === event.currentTarget.value && result.items[activeIndex]) choose(result.items[activeIndex]);
      else void search(event.currentTarget.value, 1, true);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="stock-combobox">
      <div className="asset-form-grid">
        <label>
          <span>종목 코드</span>
          <input
            value={symbol}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            onFocus={() => void search(symbol || name, 1)}
            onChange={(event) => {
              onDraftChange("symbol", event.target.value.toUpperCase());
              schedule(event.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="005930 / AAPL"
            required
          />
        </label>
        <label>
          <span>종목명</span>
          <input
            value={name}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            onFocus={() => void search(name || symbol, 1)}
            onChange={(event) => {
              onDraftChange("name", event.target.value);
              schedule(event.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="삼성전자 / Apple"
            required
          />
        </label>
      </div>

      {open ? (
        <div className="stock-options" id={listId} role="listbox">
          <div className="stock-options-head">
            <span>{loading ? "종목 검색 중…" : `검색 결과 ${result.total.toLocaleString("ko-KR")}개`}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="종목 검색 닫기">×</button>
          </div>
          {result.error ? <div className="stock-options-empty">{result.error}</div> : null}
          {!loading && !result.error && result.items.length === 0 ? <div className="stock-options-empty">일치하는 종목이 없습니다.</div> : null}
          {result.items.map((stock, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={`${stock.currency}:${stock.symbol}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(stock);
              }}
            >
              <span><strong>{stock.symbol}</strong><small>{stock.market} · {stock.currency}</small></span>
              <b>{stock.name}</b>
            </button>
          ))}
          {result.totalPages > 1 ? (
            <div className="stock-pagination">
              <button type="button" disabled={result.page <= 1 || loading} onClick={() => void search(queryRef.current, result.page - 1)}>이전</button>
              <span>{result.page.toLocaleString("ko-KR")} / {result.totalPages.toLocaleString("ko-KR")}</span>
              <button type="button" disabled={result.page >= result.totalPages || loading} onClick={() => void search(queryRef.current, result.page + 1)}>다음</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
