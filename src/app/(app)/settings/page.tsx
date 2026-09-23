import { PageHeader } from "@/components/PageHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { SettingsForm } from "@/components/SettingsForm";
import { aiEnabled, EXTRACT_MODEL, REPORT_MODEL } from "@/lib/ai/client";
import { authEnabled } from "@/lib/auth";
import { activeProviders } from "@/lib/market-data";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  let providers: string;
  try {
    providers = activeProviders().map((p) => p.label).join(" → ") || "없음";
  } catch (e) {
    providers = e instanceof Error ? e.message : "오류";
  }
  return (
    <>
      <PageHeader title="설정" back="/" />
      <div className="flex flex-col gap-3 px-4">
        <section className="card p-4">
          <SettingsForm initial={s} />
        </section>
        <section className="card flex flex-col gap-2 p-4 text-sm">
          <p className="font-semibold">내보내기</p>
          <a className="btn btn-ghost text-center" href="/api/export?type=positions">포지션 CSV</a>
          <a className="btn btn-ghost text-center" href="/api/export?type=executions">체결 CSV</a>
          <a className="btn btn-ghost text-center" href="/api/export?type=json">전체 백업 (JSON)</a>
        </section>
        <section className="card flex flex-col gap-1 p-4 text-xs text-ink-2">
          <p className="mb-1 text-sm font-semibold text-ink">연결 상태</p>
          <p>분봉 데이터: {providers}</p>
          <p>AI: {aiEnabled() ? `사용 가능 (캡처 ${EXTRACT_MODEL} · 리포트 ${REPORT_MODEL})` : "ANTHROPIC_API_KEY 미설정"}</p>
          <p>DB: {process.env.DATABASE_URL ? "Postgres" : "로컬 PGlite (개발용)"}</p>
        </section>
        {authEnabled() && <LogoutButton />}
      </div>
    </>
  );
}
