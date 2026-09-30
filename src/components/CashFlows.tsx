"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { won } from "@/lib/format";

type Flow = { id: number; date: string; type: "withdraw" | "deposit"; amountKrw: number; note: string };

/** 입출금 기록 (룰 ⑤ 추정 잔고 계산용) */
export function CashFlows({ flows, today }: { flows: Flow[]; today: string }) {
  const router = useRouter();
  const [type, setType] = useState<"withdraw" | "deposit">("withdraw");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");

  async function add() {
    await fetch("/api/cash-flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, type, amountKrw: Number(amount), note: "" }) });
    setAmount("");
    router.refresh();
  }
  async function remove(id: number) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    await fetch(`/api/cash-flows/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex gap-1">
          {(["withdraw", "deposit"] as const).map((t) => (
            <button key={t} className="chip !px-3" data-on={type === t} onClick={() => setType(t)}>
              {t === "withdraw" ? "인출" : "입금"}
            </button>
          ))}
        </div>
        <input className="input !py-2 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
      </div>
      <div className="flex gap-2">
        <input className="input tnum" inputMode="numeric" placeholder="금액 (원)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
        <button className="btn btn-ghost shrink-0" onClick={add} disabled={!Number(amount)}>
          기록
        </button>
      </div>
      {flows.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {flows.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2">
              <span className="text-ink-2">
                {f.date} · {f.type === "withdraw" ? "인출" : "입금"}
              </span>
              <span className="flex items-center gap-3">
                <span className="tnum">{won(f.type === "withdraw" ? -f.amountKrw : f.amountKrw)}</span>
                <button className="text-ink-3" aria-label="삭제" onClick={() => remove(f.id)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
