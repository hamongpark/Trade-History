import { PageHeader } from "@/components/PageHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { CashFlows } from "@/components/CashFlows";
import { RulesForm } from "@/components/RulesForm";
import { SettingsForm } from "@/components/SettingsForm";
import { withdrawalStatus } from "@/lib/domain/rules";
import { KST, fmt } from "@/lib/domain/time";
import { won } from "@/lib/format";
import { listCashFlows } from "@/lib/repo/cashflows";
import { listPositions } from "@/lib/repo/positions";
import { aiEnabled, EXTRACT_MODEL, REPORT_MODEL } from "@/lib/ai/client";
import { authEnabled } from "@/lib/auth";
import { activeProviders } from "@/lib/market-data";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [s, flows] = await Promise.all([getSettings(), listCashFlows()]);
  const w = withdrawalStatus(await listPositions({ from: s.rules.capitalStartDate ?? undefined }), flows, s.rules);
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
        <section id="rules" className="card scroll-mt-20 p-4">
          <p className="mb-1 font-semibold">그라운드 룰</p>
          <p className="mb-3 text-xs text-ink-3">매매를 기록하면 자동으로 판정하고, 홈 상단에 지금 매매해도 되는지 보여줍니다.</p>
          <RulesForm initial={s.rules} />
        </section>
        <section className="card p-4">
          <p className="mb-1 font-semibold">입출금 · 추정 잔고</p>
          <p className="mb-3 text-xs text-ink-3">
            추정 잔고 <b className="tnum text-ink">{won(w.balance, { sign: false })}</b> (거래 자금 + 기록된 순손익 ± 입출금) · 인출 기준{" "}
            {won(w.trigger, { sign: false })}
          </p>
          <CashFlows flows={flows} today={fmt(new Date(), KST, "yyyy-MM-dd")} />
        </section>
        <section className="card p-4">
          <p className="mb-3 font-semibold">기본 설정</p>
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
