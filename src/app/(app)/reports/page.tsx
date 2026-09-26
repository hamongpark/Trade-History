import Link from "next/link";
import { desc } from "drizzle-orm";
import { GenerateReport } from "@/components/GenerateReport";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { aiEnabled } from "@/lib/ai/client";
import { getDb, schema } from "@/lib/db";
import { addDays, etDate, mondayOf } from "@/lib/domain/time";
import type { Summary } from "@/lib/domain/stats";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const db = await getDb();
  const reports = await db.select().from(schema.aiReports).orderBy(desc(schema.aiReports.periodStart), desc(schema.aiReports.createdAt));
  const thisMonday = mondayOf(etDate(new Date()));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(thisMonday, -7 * i);
    return {
      start,
      label: `${i === 0 ? "이번 주" : i === 1 ? "지난주" : `${i}주 전`} (${start.slice(5)} ~ ${addDays(start, 4).slice(5)})`,
      exists: reports.some((r) => r.periodStart === start),
    };
  });

  return (
    <>
      <PageHeader title="AI 주간 리포트" />
      <div className="flex flex-col gap-3 px-4">
        <section className="card p-4">
          <p className="mb-1 text-sm font-semibold">주간 리포트 만들기</p>
          <p className="mb-3 text-xs text-ink-3">
            {aiEnabled()
              ? "매주 토요일 오전(KST)에 API 로 자동 생성됩니다. Claude 앱(구독)으로 직접 만들 수도 있습니다."
              : "Claude 앱(구독)으로 만듭니다. 추가 비용이 없습니다."}
          </p>
          <GenerateReport weeks={weeks} enabled={aiEnabled()} />
        </section>
        {reports.length === 0 && <p className="py-8 text-center text-sm text-ink-3">아직 리포트가 없습니다</p>}
        <ul className="flex flex-col gap-2">
          {reports.map((r) => {
            const s = r.stats as Summary | null;
            return (
              <li key={r.id}>
                <Link href={`/reports/${r.id}`} className="card block p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{r.periodStart} 주간</span>
                    {s && <Money value={s.netPnl} className="text-sm font-semibold" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.focus}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
