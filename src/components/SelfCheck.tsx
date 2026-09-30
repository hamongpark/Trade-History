"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 룰 ⑥ 자가 체크: 다시 봐도 진입할 자리였나 */
export function SelfCheck({ id, value }: { id: number; value: boolean | null }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  async function set(next: boolean) {
    const val = v === next ? null : next;
    setV(val);
    await fetch(`/api/positions/${id}/self-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wouldReenter: val }) });
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink-2">손절선에 닿았을 때, 다시 봐도 이 자리에 진입했을까요?</p>
      <div className="flex gap-2">
        <button className="chip flex-1" data-on={v === true} onClick={() => set(true)}>
          예 — 홀딩 정당
        </button>
        <button className="chip flex-1" data-on={v === false} onClick={() => set(false)}>
          아니오 — 손절했어야 함
        </button>
      </div>
    </div>
  );
}
