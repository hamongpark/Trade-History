"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    }
    else setErr((await res.json()).error ?? "로그인 실패");
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">매매일지</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className="input" type="password" autoComplete="current-password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-sm text-loss">{err}</p>}
        <button className="btn btn-primary" disabled={busy || !pw}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
