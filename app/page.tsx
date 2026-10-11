"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
import { useFeedback } from "@/components/FeedbackProvider";
import { useAuthStore } from "@/store/auth-store";

type IconName =
  | "grid"
  | "chart"
  | "wallet"
  | "repeat"
  | "target"
  | "settings"
  | "bell"
  | "plus"
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
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
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
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 15c.2.7 0 1.4-.5 1.9l1 1-2.6 2.6-1-1A2 2 0 0 0 13 21h-3a2 2 0 0 0-2.9-1.5l-1 1-2.6-2.6 1-1A2 2 0 0 0 3 14v-4a2 2 0 0 0 1.5-2.9l-1-1 2.6-2.6 1 1A2 2 0 0 0 10 3h4a2 2 0 0 0 2.9 1.5l1-1 2.6 2.6-1 1A2 2 0 0 0 21 10v4a2 2 0 0 0-2 1Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
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

type DashboardAsset = {
  id: string;
  ticker: string;
  name: string;
  category: string;
  value: number;
  cost: number;
  returnRate: number;
  dailyRate: number;
  weight: number;
  quoteSource: "NAVER" | "NASDAQ" | "MANUAL";
  quoteRealTime: boolean;
  quotedAt: string | null;
  assetType: "bank" | "brokerage";
};
type PortfolioResponse = {
  total: number;
  gain: number;
  returnRate: number;
  assets: DashboardAsset[];
  allocation: { brokerage: number; bank: number };
  usdKrw: number;
  updatedAt: string;
  refreshAfterSeconds: number;
};
const money = (value: number) =>
  `${Math.round(value).toLocaleString("ko-KR")}원`;

export default function Home() {
  const router = useRouter();
  const { alert } = useFeedback();
  const user = useAuthStore((state) => state.user);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DashboardAsset | null>(null);
  const [assetSettingsOpen, setAssetSettingsOpen] = useState(false);

  const loadPortfolio = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;
      setLoading(true);
      try {
        const endpoint = forceRefresh
          ? `/api/portfolio?refresh=1&t=${Date.now()}`
          : "/api/portfolio";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("자산 정보를 불러오지 못했습니다.");
        setPortfolio((await response.json()) as PortfolioResponse);
      } catch (error) {
        void alert({
          title: "자산 조회 오류",
          message:
            error instanceof Error
              ? error.message
              : "자산 정보를 불러오지 못했습니다.",
        });
      } finally {
        setLoading(false);
      }
    },
    [alert, user],
  );

  useEffect(() => {
    if (!user) return;
    const initial = window.setTimeout(() => void loadPortfolio(), 0);
    const interval = window.setInterval(() => void loadPortfolio(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadPortfolio, user]);

  const openAssetSettings = () => {
    if (!user) {
      router.push("/api/sso/login?returnTo=%2F");
      return;
    }
    setAssetSettingsOpen(true);
  };
  const stockRatio = useMemo(
    () =>
      portfolio?.total
        ? (portfolio.allocation.brokerage / portfolio.total) * 100
        : 0,
    [portfolio],
  );
  const bankRatio = Math.max(0, 100 - stockRatio);
  const displayName =
    user?.nickname ?? user?.loginId ?? user?.email?.split("@")[0] ?? "회원";
  const updatedAt = portfolio?.updatedAt
    ? new Date(portfolio.updatedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "-";

  return (
    <div className="app-shell">
      <AppSidebar
        settingsOpen={assetSettingsOpen}
        onSettingsOpenChange={setAssetSettingsOpen}
        onChanged={() => void loadPortfolio()}
      />
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">등록 자산 기준</p>
            <h1>안녕하세요, {displayName}님.</h1>
          </div>
          <div className="top-actions">
            <button
              className={`icon-button refresh-button ${loading ? "is-loading" : ""}`}
              aria-label={loading ? "새로고침 중" : "새로고침"}
              disabled={loading}
              onClick={() => void loadPortfolio(true)}
            >
              <Icon name="repeat" />
            </button>
            <button className="icon-button" aria-label="알림">
              <Icon name="bell" />
            </button>
            <button
              className="add-button desktop-add"
              onClick={openAssetSettings}
            >
              <Icon name="plus" size={18} />
              자산 등록
            </button>
          </div>
        </header>
        <section className="overview-grid">
          <article className="hero-card">
            <div className="hero-head">
              <span>총 자산</span>
              <small>{loading ? "조회 중..." : `최근 갱신 ${updatedAt}`}</small>
            </div>
            <h2>{money(portfolio?.total ?? 0)}</h2>
            <div className="performance">
              <b>
                {(portfolio?.gain ?? 0) >= 0 ? "+" : ""}
                {money(portfolio?.gain ?? 0)}
              </b>
              <span>
                {(portfolio?.returnRate ?? 0) >= 0 ? "+" : ""}
                {(portfolio?.returnRate ?? 0).toFixed(2)}%
              </span>
              <small>매입 금액 대비</small>
            </div>
            <div className="chart-wrap" aria-label="현재 자산 평가 차트">
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
            </div>
            <p className="eyebrow">주식 시세는 60초마다 자동 갱신됩니다.</p>
          </article>
          <article className="allocation-card">
            <div className="section-title">
              <div>
                <span>자산 구성</span>
                <small>등록 자산 {portfolio?.assets.length ?? 0}개</small>
              </div>
              <button aria-label="자산 구성 상세">
                <Icon name="arrow" />
              </button>
            </div>
            <div className="donut">
              <div>
                <strong>{stockRatio.toFixed(1)}%</strong>
                <small>주식</small>
              </div>
            </div>
            <div className="legend">
              <div>
                <i className="c1" />
                <span>주식</span>
                <b>{money(portfolio?.allocation.brokerage ?? 0)}</b>
                <small>{stockRatio.toFixed(1)}%</small>
              </div>
              <div>
                <i className="c4" />
                <span>은행</span>
                <b>{money(portfolio?.allocation.bank ?? 0)}</b>
                <small>{bankRatio.toFixed(1)}%</small>
              </div>
            </div>
          </article>
        </section>
        <section className="content-grid">
          <article className="holdings-card">
            <div className="section-title">
              <div>
                <span>보유 자산</span>
                <small>현재 평가 금액 기준</small>
              </div>
              <button className="text-button" onClick={openAssetSettings}>
                관리
              </button>
            </div>
            <div className="holding-header">
              <span>자산</span>
              <span>평가 금액</span>
              <span>수익률</span>
              <span>비중</span>
            </div>
            {portfolio?.assets.map((item) => (
              <button
                className="holding-row"
                key={item.id}
                onClick={() => setSelected(item)}
              >
                <span className="asset-cell">
                  <i>{item.ticker.slice(0, 1)}</i>
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
                  {item.returnRate.toFixed(2)}%
                </b>
                <span className="weight">
                  <i>
                    <em
                      style={{ width: `${Math.min(item.weight * 3, 100)}%` }}
                    />
                  </i>
                  <small>{item.weight.toFixed(1)}%</small>
                </span>
              </button>
            ))}
            {!loading && !portfolio?.assets.length && (
              <div className="empty">
                설정에서 은행 또는 주식 자산을 등록해 주세요.
              </div>
            )}
          </article>
          <article className="activity-card">
            <div className="section-title">
              <div>
                <span>시세 조회 상태</span>
                <small>현재가 제공 정보</small>
              </div>
            </div>
            <div className="transactions">
              {portfolio?.assets
                .filter((asset) => asset.assetType === "brokerage")
                .map((asset) => (
                  <div className="transaction" key={asset.id}>
                    <span className="date">
                      {asset.quoteRealTime
                        ? "실시간"
                        : asset.quoteSource === "MANUAL"
                          ? "등록가"
                          : "지연"}
                    </span>
                    <i className="tx-icon">{asset.ticker.slice(0, 1)}</i>
                    <span>
                      <b>{asset.name}</b>
                      <small>
                        {asset.quoteSource === "NAVER"
                          ? "네이버 국내 시세"
                          : asset.quoteSource === "NASDAQ"
                            ? "Nasdaq 시세"
                            : "평균 매입가 사용"}
                      </small>
                    </span>
                    <strong
                      className={asset.dailyRate >= 0 ? "positive" : "negative"}
                    >
                      {asset.dailyRate > 0 ? "+" : ""}
                      {asset.dailyRate.toFixed(2)}%
                    </strong>
                  </div>
                ))}
              {!portfolio?.assets.some(
                (asset) => asset.assetType === "brokerage",
              ) && <div className="empty">등록된 주식 자산이 없습니다.</div>}
            </div>
          </article>
        </section>
        <section className="insight-strip">
          <button
            type="button"
            className={`spark ${loading ? "is-loading" : ""}`}
            aria-label={loading ? "시세 갱신 중" : "시세 새로고침"}
            disabled={loading}
            onClick={() => void loadPortfolio(true)}
          >
            <span aria-hidden>↻</span>
          </button>
          <div>
            <strong>시세 안내</strong>
            <p>
              국내 주식은 네이버 금융, 해외 주식은 Nasdaq 공개 시세를
              사용합니다. 공식 증권사 체결 스트리밍이 아니며 제공처 상황에 따라
              지연될 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadPortfolio(true)}
          >
            {loading ? "갱신 중..." : "지금 갱신"}
          </button>
        </section>
      </main>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside
            className="detail-drawer"
            onClick={(event) => event.stopPropagation()}
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
              <i>{selected.ticker.slice(0, 1)}</i>
              <div>
                <h3>{selected.name}</h3>
                <p>
                  {selected.ticker} · {selected.category}
                </p>
              </div>
            </div>
            <div className="drawer-value">
              <small>평가 금액</small>
              <strong>{money(selected.value)}</strong>
              <b className={selected.returnRate < 0 ? "negative" : "positive"}>
                {selected.returnRate > 0 ? "+" : ""}
                {selected.returnRate.toFixed(2)}%
              </b>
            </div>
            <dl>
              <div>
                <dt>포트폴리오 비중</dt>
                <dd>{selected.weight.toFixed(1)}%</dd>
              </div>
              <div>
                <dt>매입 금액</dt>
                <dd>{money(selected.cost)}</dd>
              </div>
              <div>
                <dt>오늘 변동</dt>
                <dd
                  className={selected.dailyRate < 0 ? "negative" : "positive"}
                >
                  {selected.dailyRate > 0 ? "+" : ""}
                  {selected.dailyRate.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
