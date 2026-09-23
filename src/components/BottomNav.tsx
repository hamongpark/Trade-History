"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/trades", label: "매매", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/trades/new", label: "기록", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/analysis", label: "분석", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/reports", label: "리포트", icon: "M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" },
];

export function BottomNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : href === "/trades" ? path === "/trades" || /^\/trades\/\d+/.test(path) : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((it) => (
          <li key={it.href} className="flex-1">
            <Link href={it.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(it.href) ? "text-ink" : "text-ink-3"}`}>
              <span className={it.primary ? "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white" : "flex h-9 w-9 items-center justify-center"}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.icon} />
                </svg>
              </span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
