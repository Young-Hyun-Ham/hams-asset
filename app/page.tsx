"use client";

import { useEffect, useMemo, useState } from "react";

type IconName =
  | "grid"
  | "chart"
  | "wallet"
  | "repeat"
  | "target"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "more"
  | "arrow"
  | "close";
const paths: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6h14a2 2 0 0 1 2 2v10H5a3 3 0 0 1-3-3V6.5A2.5 2.5 0 0 1 4.5 4H17" />
      <path d="M15 11h7v4h-7a2 2 0 0 1 0-4Z" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M21 12h-3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 15c.2.7 0 1.4-.5 1.9l1 1-2.6 2.6-1-1A2 2 0 0 0 13 21h-3a2 2 0 0 0-2.9-1.5l-1 1-2.6-2.6 1-1A2 2 0 0 0 3 14v-4a2 2 0 0 0 1.5-2.9l-1-1 2.6-2.6 1 1A2 2 0 0 0 10 3h4a2 2 0 0 0 2.9 1.5l1-1 2.6 2.6-1 1A2 2 0 0 0 21 10v4a2 2 0 0 0-2 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

const holdings = [
  {
    ticker: "AAPL",
    name: "Apple",
    category: "미국 주식",
    value: 31245000,
    returnRate: 18.42,
    weight: 23.3,
    color: "#171717",
  },
  {
    ticker: "VOO",
    name: "Vanguard S&P 500",
    category: "ETF",
    value: 24780000,
    returnRate: 11.08,
    weight: 18.5,
    color: "#356e59",
  },
  {
    ticker: "005930",
    name: "삼성전자",
    category: "국내 주식",
    value: 18960000,
    returnRate: -3.21,
    weight: 14.2,
    color: "#315bd5",
  },
  {
    ticker: "BTC",
    name: "Bitcoin",
    category: "디지털 자산",
    value: 15420000,
    returnRate: 27.84,
    weight: 11.5,
    color: "#ef9e3d",
  },
];
const transactions = [
  {
    date: "10월 7일",
    title: "VOO 매수",
    detail: "Vanguard S&P 500 · 3주",
    amount: "− ₩1,842,300",
    type: "매수",
  },
  {
    date: "10월 4일",
    title: "배당금 입금",
    detail: "Apple · 분기 배당",
    amount: "+ ₩182,400",
    type: "배당",
  },
  {
    date: "9월 28일",
    title: "삼성전자 매도",
    detail: "삼성전자 · 20주",
    amount: "+ ₩1,397,000",
    type: "매도",
  },
  {
    date: "9월 22일",
    title: "정기 예금 이자",
    detail: "하나은행 · 이자",
    amount: "+ ₩94,600",
    type: "이자",
  },
];
const periods = {
  "1개월": 0.021,
  "3개월": 0.038,
  "6개월": 0.054,
  "1년": 0.084,
  전체: 0.142,
};
const money = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

export default function Home() {
  const [period, setPeriod] = useState<keyof typeof periods>("1년");
  const [assetType, setAssetType] = useState("전체");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof holdings)[number] | null>(
    null,
  );
  const [notice, setNotice] = useState(false);
  const total = 134208400,
    gain = total * periods[period];
  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (assetType === "전체" || t.type === assetType) &&
          `${t.title}${t.detail}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [assetType, query],
  );
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: unknown,
            options?: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "filter_portfolio_view",
          title: "포트폴리오 보기 필터",
          description: "HAMS 포트폴리오의 수익 기간과 거래 유형을 변경합니다.",
          inputSchema: {
            type: "object",
            properties: {
              period: { type: "string", enum: Object.keys(periods) },
              transactionType: {
                type: "string",
                enum: ["전체", "매수", "매도", "배당", "이자"],
              },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const value = input as {
              period?: keyof typeof periods;
              transactionType?: string;
            };
            if (value.period && value.period in periods)
              setPeriod(value.period);
            if (
              value.transactionType &&
              ["전체", "매수", "매도", "배당", "이자"].includes(
                value.transactionType,
              )
            )
              setAssetType(value.transactionType);
            return {
              period: value.period ?? period,
              transactionType: value.transactionType ?? assetType,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [period, assetType]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <span>HAMS</span>
        </div>
        <nav aria-label="주요 메뉴">
          <button className="nav-item active">
            <Icon name="grid" />
            대시보드
          </button>
          <button className="nav-item">
            <Icon name="chart" />
            포트폴리오
          </button>
          <button className="nav-item">
            <Icon name="wallet" />
            계좌
          </button>
          <button className="nav-item">
            <Icon name="repeat" />
            거래
          </button>
          <button className="nav-item">
            <Icon name="target" />
            목표
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Icon name="settings" />
            설정
          </button>
          <div className="profile">
            <span>HM</span>
            <div>
              <strong>함민수</strong>
              <small>개인 계정</small>
            </div>
            <Icon name="more" />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">2026년 10월 7일 수요일</p>
            <h1>좋은 아침이에요, 민수님.</h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="검색"
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>("#transaction-search")
                  ?.focus()
              }
            >
              <Icon name="search" />
            </button>
            <button
              className="icon-button notification"
              aria-label="알림"
              onClick={() => setNotice(!notice)}
            >
              <Icon name="bell" />
              <i />
            </button>
            <button
              className="add-button"
              onClick={() => alert("자산 연결 기능은 데모 화면입니다.")}
            >
              <Icon name="plus" size={18} />
              자산 연결
            </button>
          </div>
          {notice && (
            <div className="notice-pop">
              <strong>리밸런싱 알림</strong>
              <p>미국 주식 비중이 목표보다 3.2% 높아요.</p>
            </div>
          )}
        </header>
        <section className="overview-grid">
          <article className="hero-card">
            <div className="hero-head">
              <span>순자산</span>
              <button aria-label="순자산 메뉴">
                <Icon name="more" />
              </button>
            </div>
            <h2>{money(total)}</h2>
            <div className="performance">
              <b>+{money(gain)}</b>
              <span>+{(periods[period] * 100).toFixed(1)}%</span>
              <small>{period} 전 대비</small>
            </div>
            <div
              className="chart-wrap"
              aria-label={`${period} 순자산 추이 차트`}
            >
              <svg viewBox="0 0 760 210" preserveAspectRatio="none" role="img">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#c7ff55" stopOpacity=".32" />
                    <stop offset="1" stopColor="#c7ff55" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="area"
                  d="M0 180 C55 175 65 130 120 146 S210 106 260 125 S340 78 402 98 S476 67 526 78 S614 36 760 18 L760 210 L0 210Z"
                />
                <path
                  className="line"
                  d="M0 180 C55 175 65 130 120 146 S210 106 260 125 S340 78 402 98 S476 67 526 78 S614 36 760 18"
                />
                <circle cx="760" cy="18" r="5" />
              </svg>
              <div className="axis">
                <span>10월</span>
                <span>1월</span>
                <span>4월</span>
                <span>7월</span>
                <span>10월</span>
              </div>
            </div>
            <div className="periods" role="group" aria-label="조회 기간">
              {(Object.keys(periods) as (keyof typeof periods)[]).map((p) => (
                <button
                  key={p}
                  className={period === p ? "selected" : ""}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </article>
          <article className="allocation-card">
            <div className="section-title">
              <div>
                <span>자산 구성</span>
                <small>총 6개 자산군</small>
              </div>
              <button aria-label="자산 구성 상세">
                <Icon name="arrow" />
              </button>
            </div>
            <div className="donut">
              <div>
                <strong>48.2%</strong>
                <small>주식</small>
              </div>
            </div>
            <div className="legend">
              <div>
                <i className="c1" />
                <span>주식</span>
                <b>₩64.7M</b>
                <small>48.2%</small>
              </div>
              <div>
                <i className="c2" />
                <span>ETF</span>
                <b>₩28.4M</b>
                <small>21.2%</small>
              </div>
              <div>
                <i className="c3" />
                <span>디지털 자산</span>
                <b>₩15.4M</b>
                <small>11.5%</small>
              </div>
              <div>
                <i className="c4" />
                <span>예금 · 현금</span>
                <b>₩25.7M</b>
                <small>19.1%</small>
              </div>
            </div>
          </article>
        </section>
        <section className="content-grid">
          <article className="holdings-card">
            <div className="section-title">
              <div>
                <span>주요 보유 자산</span>
                <small>평가금액 기준</small>
              </div>
              <button className="text-button">전체 보기</button>
            </div>
            <div className="holding-header">
              <span>자산</span>
              <span>평가금액</span>
              <span>수익률</span>
              <span>비중</span>
            </div>
            {holdings.map((item) => (
              <button
                className="holding-row"
                key={item.ticker}
                onClick={() => setSelected(item)}
              >
                <span className="asset-cell">
                  <i style={{ background: item.color }}>
                    {item.ticker === "005930" ? "S" : item.ticker.slice(0, 1)}
                  </i>
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.ticker} · {item.category}
                    </small>
                  </span>
                </span>
                <b>{money(item.value)}</b>
                <b className={item.returnRate < 0 ? "negative" : "positive"}>
                  {item.returnRate > 0 ? "+" : ""}
                  {item.returnRate}%
                </b>
                <span className="weight">
                  <i>
                    <em style={{ width: `${item.weight * 3}%` }} />
                  </i>
                  <small>{item.weight}%</small>
                </span>
              </button>
            ))}
          </article>
          <article className="activity-card">
            <div className="section-title">
              <div>
                <span>최근 거래</span>
                <small>연결된 모든 계좌</small>
              </div>
              <button className="text-button">전체 보기</button>
            </div>
            <div className="activity-tools">
              <label>
                <Icon name="search" size={16} />
                <input
                  id="transaction-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="거래 검색"
                />
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                aria-label="거래 유형"
              >
                <option>전체</option>
                <option>매수</option>
                <option>매도</option>
                <option>배당</option>
                <option>이자</option>
              </select>
            </div>
            <div className="transactions">
              {filtered.map((t) => (
                <div className="transaction" key={t.title}>
                  <span className="date">{t.date}</span>
                  <i className={`tx-icon ${t.type}`}>
                    {t.type === "매수" ? "B" : t.type === "매도" ? "S" : "₩"}
                  </i>
                  <span>
                    <b>{t.title}</b>
                    <small>{t.detail}</small>
                  </span>
                  <strong
                    className={t.amount.startsWith("+") ? "positive" : ""}
                  >
                    {t.amount}
                  </strong>
                </div>
              ))}
              {!filtered.length && (
                <div className="empty">조건에 맞는 거래가 없습니다.</div>
              )}
            </div>
          </article>
        </section>
        <section className="insight-strip">
          <span className="spark">✦</span>
          <div>
            <strong>이번 달 자산 인사이트</strong>
            <p>
              포트폴리오가 시장보다 <b>2.4%p</b> 높은 성과를 냈어요. 미국 주식
              비중은 목표보다 조금 높습니다.
            </p>
          </div>
          <button>자세히 보기</button>
        </section>
      </main>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <button className="active">
          <Icon name="grid" />
          <span>홈</span>
        </button>
        <button>
          <Icon name="chart" />
          <span>포트폴리오</span>
        </button>
        <button className="mobile-add">
          <Icon name="plus" />
        </button>
        <button>
          <Icon name="repeat" />
          <span>거래</span>
        </button>
        <button>
          <Icon name="settings" />
          <span>설정</span>
        </button>
      </nav>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside
            className="detail-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="자산 상세"
          >
            <button
              className="drawer-close"
              onClick={() => setSelected(null)}
              aria-label="닫기"
            >
              <Icon name="close" />
            </button>
            <span className="drawer-label">보유 자산 상세</span>
            <div className="drawer-identity">
              <i style={{ background: selected.color }}>
                {selected.ticker.slice(0, 1)}
              </i>
              <div>
                <h3>{selected.name}</h3>
                <p>
                  {selected.ticker} · {selected.category}
                </p>
              </div>
            </div>
            <div className="drawer-value">
              <small>평가금액</small>
              <strong>{money(selected.value)}</strong>
              <b className={selected.returnRate < 0 ? "negative" : "positive"}>
                {selected.returnRate > 0 ? "+" : ""}
                {selected.returnRate}%
              </b>
            </div>
            <div className="mini-chart">
              <svg viewBox="0 0 340 100" preserveAspectRatio="none">
                <path d="M0 84 C40 70 60 78 90 60 S145 64 176 42 S240 48 274 28 S310 24 340 10" />
              </svg>
            </div>
            <dl>
              <div>
                <dt>포트폴리오 비중</dt>
                <dd>{selected.weight}%</dd>
              </div>
              <div>
                <dt>평균 매입가</dt>
                <dd>{money(selected.value / 1.12)}</dd>
              </div>
              <div>
                <dt>오늘 변동</dt>
                <dd className="positive">+1.24%</dd>
              </div>
            </dl>
            <button className="drawer-action">거래 내역 보기</button>
          </aside>
        </div>
      )}
    </div>
  );
}
