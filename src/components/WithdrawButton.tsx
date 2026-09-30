"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 룰 ⑤: 인출 완료 기록 */
export function WithdrawButton({ amountKrw, date }: { amountKrw: number; date: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(Math.round(amountKrw)));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch("/api/cash-flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: "withdraw", amountKrw: Number(amount), note: "룰 ⑤ 초과분 인출" }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <input className="input tnum" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} aria-label="인출 금액(원)" />
      <button className="btn btn-primary shrink-0" onClick={save} disabled={busy || !Number(amount)}>
        인출 완료
      </button>
    </div>
  );
}
