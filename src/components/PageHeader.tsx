import Link from "next/link";

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg/95 px-4 pb-3 backdrop-blur" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
      {back && (
        <Link href={back} aria-label="뒤로" className="-ml-2 p-2 text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-lg font-bold">{title}</h1>
      {right}
    </header>
  );
}
