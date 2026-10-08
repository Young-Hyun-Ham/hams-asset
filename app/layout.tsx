import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAMS | 나의 자산 대시보드",
  description:
    "흩어진 자산을 한눈에 확인하고 더 나은 금융 결정을 내리는 개인 자산관리 대시보드",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
