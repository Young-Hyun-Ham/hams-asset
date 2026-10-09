"use client";

import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/store/auth-store";

const genderLabels = {
  male: "남성",
  female: "여성",
  other: "기타",
  prefer_not_to_say: "미공개",
} as const;

export default function UserAccountMenu() {
  const user = useAuthStore((state) => state.user);
  const authChecked = useAuthStore((state) => state.authChecked);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!authChecked) {
    return <div className="account-loading" aria-label="로그인 정보 확인 중" />;
  }

  if (!user) {
    return (
      <a className="account-login" href="/api/sso/login?returnTo=%2F">
        통합 로그인
      </a>
    );
  }

  const name = user.nickname || user.loginId || user.email || "사용자";
  const membership = user.serviceMemberships?.[0] ?? null;
  const gender = user.gender ? genderLabels[user.gender] : "미등록";

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="account-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span className="account-summary">
          <strong>{name}</strong>
          <small>{user.email}</small>
        </span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div className="account-popover" role="menu">
          <div className="account-popover-head">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          <dl>
            <div><dt>생년월일</dt><dd>{user.birthDate || "미등록"}</dd></div>
            <div><dt>성별</dt><dd>{gender}</dd></div>
            <div><dt>서비스</dt><dd>{membership?.serviceName || "가입정보 없음"}</dd></div>
            <div><dt>사이트 등급</dt><dd>{membership?.plan || "-"}</dd></div>
            <div><dt>함포</dt><dd>{user.hampoBalance.toLocaleString("ko-KR")}</dd></div>
            <div><dt>AI 사용</dt><dd className={user.aiEnabled ? "enabled" : ""}>{user.aiEnabled ? "AI ON" : "AI OFF"}</dd></div>
          </dl>
          <div className="account-actions">
            <a href="/api/auth/profile?returnTo=%2F">회원정보 수정</a>
            <a href="/api/auth/profile?destination=services&returnTo=%2F">사이트 등급 설정</a>
            <a className="logout" href="/api/auth/logout?returnTo=%2F">로그아웃</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
