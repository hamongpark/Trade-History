"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TradeActions({ id, candlesStatus }: { id: number; candlesStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function refetch() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/positions/${id}/candles`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) setMsg(json.error ?? "분봉을 가져오지 못했습니다");
    router.refresh();
  }
  async function remove() {
    if (!confirm("이 매매 기록을 삭제할까요?")) return;
    await fetch(`/api/positions/${id}`, { method: "DELETE" });
    router.push("/trades");
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Link href={`/trades/${id}/edit`} className="btn btn-ghost text-center">
          수정
        </Link>
        <button className="btn btn-ghost" onClick={refetch} disabled={busy}>
          {busy ? "불러오는 중" : candlesStatus === "ok" ? "분봉 새로고침" : "분봉 불러오기"}
        </button>
        <button className="btn btn-ghost text-loss" onClick={remove}>
          삭제
        </button>
      </div>
      {msg && <p className="text-xs text-warn">{msg}</p>}
    </div>
  );
}
