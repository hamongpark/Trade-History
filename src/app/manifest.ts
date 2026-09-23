import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "매매일지 - Trade History",
    short_name: "매매일지",
    description: "미국 주식 스캘핑 매매 기록 · 분석",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0f13",
    theme_color: "#0e0f13",
    lang: "ko",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
