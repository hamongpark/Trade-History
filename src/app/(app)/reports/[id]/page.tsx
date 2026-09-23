import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { PageHeader } from "@/components/PageHeader";
import { getDb, schema } from "@/lib/db";
import { addDays } from "@/lib/domain/time";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const db = await getDb();
  const [r] = await db.select().from(schema.aiReports).where(eq(schema.aiReports.id, Number((await params).id)));
  if (!r) notFound();
  return (
    <>
      <PageHeader title={`${r.periodStart.slice(5)} ~ ${addDays(r.periodStart, 4).slice(5)} 리포트`} back="/reports" />
      <div className="flex flex-col gap-3 px-4">
        <section className="card border-accent/40 p-4">
          <p className="text-xs text-ink-3">다음 주 집중할 한 가지</p>
          <p className="mt-1 font-semibold leading-snug">{r.focus}</p>
        </section>
        <article className="md card p-4">
          <Markdown>{r.content}</Markdown>
        </article>
        <p className="px-1 text-[11px] text-ink-3">
          {r.model} · 입력 {r.inputTokens?.toLocaleString()} / 출력 {r.outputTokens?.toLocaleString()} 토큰 · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </div>
    </>
  );
}
