"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import AssetSettingsDrawer from "./AssetSettingsDrawer";
import UserAccountMenu from "./UserAccountMenu";
import { useAuthStore } from "@/store/auth-store";

type IconName = "grid" | "chart" | "wallet" | "repeat" | "target" | "settings" | "plus";
const paths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H5a3 3 0 0 1-3-3V6.5A2.5 2.5 0 0 1 4.5 4H17" /><path d="M15 11h7v4h-7a2 2 0 0 1 0-4Z" /></>,
  repeat: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M21 12h-3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 15c.2.7 0 1.4-.5 1.9l1 1-2.6 2.6-1-1A2 2 0 0 0 13 21h-3a2 2 0 0 0-2.9-1.5l-1 1-2.6-2.6 1-1A2 2 0 0 0 3 14v-4a2 2 0 0 0 1.5-2.9l-1-1 2.6-2.6 1 1A2 2 0 0 0 10 3h4a2 2 0 0 0 2.9 1.5l1-1 2.6 2.6-1 1A2 2 0 0 0 21 10v4a2 2 0 0 0-2 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
};
function MenuIcon({ name }: { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

const items: Array<{ href?: string; label: string; icon: IconName }> = [
  { href: "/", label: "대시보드", icon: "grid" },
  { href: "/portfolio", label: "포트폴리오", icon: "chart" },
  { href: "/accounts", label: "계좌", icon: "wallet" },
  { href: "/transactions", label: "거래", icon: "repeat" },
  { href: "/goals", label: "목표", icon: "target" },
];

type Props = {
  onChanged?: () => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
};

export default function AppSidebar({ onChanged, settingsOpen: controlledOpen, onSettingsOpenChange }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [internalOpen, setInternalOpen] = useState(false);
  const settingsOpen = controlledOpen ?? internalOpen;
  const setSettingsOpen = (open: boolean) => { setInternalOpen(open); onSettingsOpenChange?.(open); };
  const openSettings = () => {
    if (!user) { router.push("/api/sso/login?returnTo=%2F"); return; }
    setSettingsOpen(true);
  };
  return <>
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">H</span><span>HAMS</span></Link>
      <nav aria-label="주요 메뉴">{items.map((item) => item.href
        ? <Link key={item.label} href={item.href} className={`nav-item ${pathname === item.href ? "active" : ""}`}><MenuIcon name={item.icon} />{item.label}</Link>
        : <button key={item.label} className="nav-item" type="button"><MenuIcon name={item.icon} />{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={openSettings}><MenuIcon name="settings" />설정</button><UserAccountMenu /></div>
    </aside>
    <nav className="mobile-nav" aria-label="모바일 메뉴">
      <Link className={pathname === "/" ? "active" : ""} href="/"><MenuIcon name="grid" /><small>홈</small></Link>
      <Link className={pathname === "/portfolio" ? "active" : ""} href="/portfolio"><MenuIcon name="chart" /><small>자산</small></Link>
      <button className="mobile-add" onClick={openSettings}><MenuIcon name="plus" /></button>
      <Link className={pathname === "/goals" ? "active" : ""} href="/goals"><MenuIcon name="target" /><small>목표</small></Link>
      <button onClick={openSettings}><MenuIcon name="settings" /><small>설정</small></button>
    </nav>
    <AssetSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onAssetsChanged={onChanged} />
  </>;
}
