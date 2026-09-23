import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "매매일지",
  description: "미국 주식 스캘핑 매매 기록 · 분석",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "매매일지" },
};

export const viewport: Viewport = {
  themeColor: "#0e0f13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
