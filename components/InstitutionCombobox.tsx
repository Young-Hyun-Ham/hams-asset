"use client";

import { useId, useMemo, useRef, useState } from "react";

import type { FinancialInstitution } from "@/lib/financial-institutions";
import { matchesKoreanSearch } from "@/lib/korean-search";

type Props = {
  name: string;
  label: string;
  placeholder: string;
  options: FinancialInstitution[];
};

export default function InstitutionCombobox({ name, label, placeholder, options }: Props) {
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return options;
    return options.filter((option) => matchesKoreanSearch(option.name, keyword)
      || option.code.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()));
  }, [options, query]);

  const select = (option: FinancialInstitution) => {
    setQuery(option.name);
    setOpen(false);
    setActiveIndex(0);
  };

  return (
    <label className="institution-field">
      <span>{label}</span>
      <div className="institution-combobox">
        <input
          name={name}
          value={query}
          placeholder={placeholder}
          required
          maxLength={80}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].code}` : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => filtered.length ? Math.min(current + 1, filtered.length - 1) : 0);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && open && filtered[activeIndex]) {
              event.preventDefault();
              select(filtered[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button type="button" className="institution-toggle" aria-label={`${label} 목록 열기`} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((current) => !current)}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
        {open ? (
          <div className="institution-options" id={listId} role="listbox">
            {!query ? <div className="institution-search-hint">기관명 또는 초성으로 검색할 수 있습니다. 예: ㅅㅎ</div> : null}
            {filtered.map((option, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${option.code}`}
                aria-selected={query === option.name}
                className={index === activeIndex ? "active" : ""}
                key={option.code}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  select(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span>{option.name}</span>
                {query === option.name ? <b>선택됨</b> : null}
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="institution-custom">목록에 없습니다. 입력한 기관명으로 직접 등록할 수 있습니다.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </label>
  );
}
