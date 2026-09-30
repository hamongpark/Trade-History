"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeMetrics, groupIntoPositions, pctToPrices, type RawExecution } from "@/lib/domain/position";
import { addDays, etDate, fmt, localToUtc } from "@/lib/domain/time";
import { CAPTURE_PROMPT, parsePastedExtraction, type Extraction } from "@/lib/domain/pasted";
import { price as fmtPrice, pct, pnlClass, usd, won } from "@/lib/format";
import { CLAUDE_APP_URL, copyText } from "@/lib/clipboard";
import { downscaleImage } from "@/lib/image";
import { emptyFill, emptyValues, newKey, type FillRow, type FormValues } from "@/lib/trade-form";

export interface FormSettings {
  inputTimezone: string;
  feeRatePct: number;
  setupTags: string[];
  emotionTags: string[];
  defaultStopPct: number | null;
  defaultTargetPct: number | null;
}

const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

function toPayload(v: FormValues, tz: string) {
  return {
    ticker: v.ticker,
    stopPct: toNum(v.stopPct),
    targetPct: toNum(v.targetPct),
    fxRate: toNum(v.fxRate),
    setupTags: v.setupTags,
    emotionTags: v.emotionTags,
    confidence: v.confidence,
    followedPlan: v.followedPlan,
    entryReason: v.entryReason,
    exitReason: v.exitReason,
    note: v.note,
    executions: v.fills
      .filter((f) => f.time && f.price && f.qty)
      .map((f) => ({
        side: f.side,
        executedAt: localToUtc(f.date, f.time, tz).toISOString(),
        price: Number(f.price),
        qty: Number(f.qty),
        fee: toNum(f.fee),
      })),
  };
}

interface Draft {
  ticker: string;
  fills: FillRow[];
}

export function TradeForm({
  settings,
  initial,
  positionId,
  defaultDate,
  aiEnabled = false,
}: {
  settings: FormSettings;
  initial: FormValues;
  positionId?: number;
  defaultDate: string;
  /** ANTHROPIC_API_KEY 가 있으면 앱에서 바로 캡처 분석 */
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const tz = settings.inputTimezone;
  const blank = () => emptyValues(defaultDate, { stopPct: settings.defaultStopPct, targetPct: settings.defaultTargetPct });
  const [v, setV] = useState<FormValues>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const setFill = (key: string, patch: Partial<FillRow>) =>
    setV((s) => ({ ...s, fills: s.fills.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const toggle = (k: "setupTags" | "emotionTags", tag: string) =>
    set(k, v[k].includes(tag) ? v[k].filter((t) => t !== tag) : [...v[k], tag]);

  const preview = useMemo(() => {
    try {
      const ex = toPayload(v, tz).executions.map((e) => ({
        ...e,
        executedAt: new Date(e.executedAt),
        fee: e.fee ?? Math.round(e.price * e.qty * settings.feeRatePct) / 100, // 서버와 같은 센트 단위 반올림
      }));
      if (!ex.length) return null;
      return computeMetrics(ex, toNum(v.stopPct));
    } catch {
      return null;
    }
  }, [v, tz, settings.feeRatePct]);

  // 첫 체결의 미국 거래일 기준 환율을 자동으로 불러와 미리보기·안내에 사용
  const tradeDate = useMemo(() => {
    const first = v.fills.find((f) => f.date && f.time);
    try {
      return first ? etDate(localToUtc(first.date, first.time, tz)) : null;
    } catch {
      return null;
    }
  }, [v.fills, tz]);
  const [autoFx, setAutoFx] = useState<{ rate: number; rateDate: string; provisional: boolean } | null>(null);
  useEffect(() => {
    const date = tradeDate ?? defaultDate;
    let alive = true;
    fetch(`/api/fx?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setAutoFx(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tradeDate, defaultDate]);
  const rate = toNum(v.fxRate) ?? autoFx?.rate ?? null;
  const prices = preview ? pctToPrices(preview.avgEntry, toNum(v.stopPct), toNum(v.targetPct)) : null;

  /** 추출 결과(API 또는 Claude 앱 붙여넣기)를 포지션 단위로 묶어 폼/목록에 반영 */
  function applyExtraction(ex: Extraction) {
    const raw: RawExecution[] = [];
    let prev: { date: string; time: string } | null = null;
    for (const f of ex.fills) {
      let date: string = f.date ?? prev?.date ?? defaultDate;
      // 날짜가 없는 캡처에서 자정을 넘긴 경우 (예: 23:50 → 00:10) 다음 날로 처리
      if (!f.date && prev && f.time < prev.time && prev.time >= "18:00" && f.time < "12:00") date = addDays(prev.date, 1);
      prev = { date, time: f.time };
      raw.push({ ticker: f.ticker, side: f.side, executedAt: localToUtc(date, f.time, tz), price: f.price, qty: f.qty, fee: f.fee ?? 0 });
    }
    const { groups, orphans } = groupIntoPositions(raw);
    const found: Draft[] = groups.map((g) => ({
      ticker: g.ticker,
      fills: g.executions.map((e) => ({
        key: newKey(),
        side: e.side,
        date: fmt(e.executedAt, tz, "yyyy-MM-dd"),
        time: fmt(e.executedAt, tz, "HH:mm"),
        price: String(e.price),
        qty: String(e.qty),
        fee: e.fee ? String(e.fee) : "",
      })),
    }));
    const warn = [...ex.warnings];
    if (orphans.length) warn.push(`매수 기록 없이 매도만 있는 체결 ${orphans.length}건은 제외했습니다 (${orphans.map((o) => o.ticker).join(", ")})`);
    setWarnings(warn);
    if (found.length === 0) throw new Error("체결 내역을 찾지 못했습니다");
    if (found.length === 1 && !positionId) {
      setV((s) => ({ ...s, ticker: found[0].ticker, fills: found[0].fills }));
    } else {
      setDrafts(found);
    }
  }

  async function importScreenshots(files: FileList | null) {
    if (!files?.length) return;
    setBusy("캡처 분석 중… (10~30초)");
    setError(null);
    setWarnings([]);
    try {
      const form = new FormData();
      form.set("date", defaultDate);
      for (const f of Array.from(files).slice(0, 5)) form.append("images", await downscaleImage(f), "shot.jpg");
      const res = await fetch("/api/import/screenshot", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "분석 실패");
      applyExtraction(json as Extraction);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function copyCapturePrompt() {
    const ok = await copyText(CAPTURE_PROMPT);
    setPromptCopied(ok);
    if (!ok) setError("복사 권한이 없습니다. 아래 요청문을 길게 눌러 복사하세요");
  }

  function importPasted() {
    setError(null);
    setWarnings([]);
    try {
      applyExtraction(parsePastedExtraction(pasted));
      setPasted("");
      setShowPaste(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveAllDrafts() {
    setBusy("저장 중…");
    setError(null);
    const payload = drafts.map((d) => toPayload({ ...blank(), ticker: d.ticker, fills: d.fills }, tz));
    const res = await fetch("/api/positions/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(null);
    if (!res.ok) return setError((await res.json()).error ?? "저장 실패");
    router.push("/trades?incomplete=1");
    router.refresh();
  }

  async function submit() {
    setError(null);
    const payload = toPayload(v, tz);
    if (!payload.ticker) return setError("티커를 입력하세요");
    if (!payload.executions.length) return setError("체결 내역을 입력하세요 (시각·가격·수량)");
    if (!payload.executions.some((e) => e.side === "buy")) return setError("매수 체결이 필요합니다");
    setBusy("저장 중…");
    const res = await fetch(positionId ? `/api/positions/${positionId}` : "/api/positions", {
      method: positionId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "저장 실패");
    if (drafts.length) {
      // 캡처에서 가져온 나머지 포지션이 남아 있으면 폼을 비우고 계속 입력
      setV(blank());
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/trades/${json.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      {!positionId && aiEnabled && (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => importScreenshots(e.target.files)} />
          <button className="btn btn-ghost flex items-center justify-center gap-2" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            📷 체결내역 캡처로 채우기
          </button>
        </>
      )}
      {!positionId && (
        <section className="card p-3">
          <button className="flex w-full items-center justify-between text-sm" onClick={() => setShowPaste((x) => !x)}>
            <span className="font-semibold">📋 Claude 앱으로 캡처 읽기</span>
            <span className="text-ink-3">{showPaste ? "접기" : "펼치기"}</span>
          </button>
          {showPaste && (
            <ol className="mt-3 flex flex-col gap-3 text-sm">
              <li className="flex flex-col gap-2">
                <span className="text-ink-2">① 요청문을 복사해 Claude 앱 새 대화에 체결내역 캡처와 함께 보내기</span>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-ghost" onClick={copyCapturePrompt}>
                    {promptCopied ? "✓ 복사됨" : "요청문 복사"}
                  </button>
                  <a className="btn btn-ghost text-center" href={CLAUDE_APP_URL} target="_blank" rel="noreferrer">
                    Claude 열기 ↗
                  </a>
                </div>
                {error?.startsWith("복사 권한") && (
                  <textarea className="input min-h-24 text-xs" readOnly value={CAPTURE_PROMPT} onFocus={(e) => e.currentTarget.select()} />
                )}
              </li>
              <li className="flex flex-col gap-2">
                <span className="text-ink-2">② Claude 답변(JSON)을 복사해 붙여넣기</span>
                <textarea className="input min-h-24 font-mono text-xs" placeholder='{"fills":[…]}' value={pasted} onChange={(e) => setPasted(e.target.value)} />
                <button className="btn btn-primary" onClick={importPasted} disabled={!pasted.trim()}>
                  체결 불러오기
                </button>
              </li>
            </ol>
          )}
        </section>
      )}
      {busy && <p className="text-center text-sm text-ink-2">{busy}</p>}
      {error && <p className="rounded-lg bg-loss/15 px-3 py-2 text-sm text-ink">{error}</p>}
      {warnings.map((w) => (
        <p key={w} className="rounded-lg bg-warn/15 px-3 py-2 text-xs text-warn">
          {w}
        </p>
      ))}

      {drafts.length > 0 && (
        <section className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">캡처에서 {drafts.length}개 포지션 발견</p>
            <button className="text-sm text-accent" onClick={saveAllDrafts} disabled={!!busy}>
              모두 저장 (사유는 나중에)
            </button>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {drafts.map((d, i) => {
              const m = (() => {
                try {
                  return computeMetrics(toPayload({ ...blank(), ticker: d.ticker, fills: d.fills }, tz).executions.map((e) => ({ ...e, executedAt: new Date(e.executedAt), fee: e.fee ?? 0 })));
                } catch {
                  return null;
                }
              })();
              return (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <b>{d.ticker}</b> <span className="text-ink-3">{d.fills[0].time}–{d.fills[d.fills.length - 1].time} · {d.fills.length}체결</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {m && <span className={`tnum ${pnlClass(m.grossPnl)}`}>{rate ? won(m.grossPnl * rate) : usd(m.grossPnl)}</span>}
                    <button
                      className="text-accent"
                      onClick={() => {
                        setV({ ...blank(), ticker: d.ticker, fills: d.fills });
                        setDrafts((ds) => ds.filter((_, j) => j !== i));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      편집
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Field label="티커">
        <input className="input uppercase" placeholder="예: NVDA" autoCapitalize="characters" value={v.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} />
      </Field>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-ink-2">체결 내역 <span className="text-ink-3">({tz === "Asia/Seoul" ? "한국시간" : tz})</span></p>
          <div className="flex gap-2">
            <button className="chip" onClick={() => set("fills", [...v.fills, emptyFill("buy", v.fills.at(-1)?.date ?? defaultDate)])}>+ 매수</button>
            <button className="chip" onClick={() => set("fills", [...v.fills, emptyFill("sell", v.fills.at(-1)?.date ?? defaultDate)])}>+ 매도</button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {v.fills.map((f) => (
            <div key={f.key} className="rounded-xl border border-border bg-surface-1 p-2">
              <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1.15fr)_20px] items-center gap-2">
                <button
                  className={`rounded-lg py-2 text-sm font-semibold ${f.side === "buy" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"}`}
                  onClick={() => setFill(f.key, { side: f.side === "buy" ? "sell" : "buy" })}
                >
                  {f.side === "buy" ? "매수" : "매도"}
                </button>
                <input className="input min-w-0 !px-2 !py-2" type="time" value={f.time} onChange={(e) => setFill(f.key, { time: e.target.value })} aria-label="체결 시각" />
                <input className="input min-w-0 !px-2 !py-2 text-sm" type="date" value={f.date} onChange={(e) => setFill(f.key, { date: e.target.value })} aria-label="체결 날짜" />
                <button className="text-ink-3" aria-label="삭제" onClick={() => set("fills", v.fills.filter((x) => x.key !== f.key))}>✕</button>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-2">
                <input className="input !py-2" inputMode="decimal" placeholder="체결가 $" value={f.price} onChange={(e) => setFill(f.key, { price: e.target.value })} />
                <input className="input !py-2" inputMode="decimal" placeholder="수량" value={f.qty} onChange={(e) => setFill(f.key, { qty: e.target.value })} />
                <input className="input !py-2" inputMode="decimal" placeholder="수수료" value={f.fee} onChange={(e) => setFill(f.key, { fee: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {preview && (
        <section className="card grid grid-cols-3 gap-2 p-3 text-center">
          <div>
            <p className="text-[11px] text-ink-3">순손익 (예상)</p>
            <p className={`tnum font-semibold ${pnlClass(preview.netPnl)}`}>
              {preview.status !== "closed" ? "미청산" : rate ? won(preview.netPnl * rate) : usd(preview.netPnl)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-ink-3">수익률</p>
            <p className="tnum font-semibold">{preview.status === "closed" ? pct(preview.returnPct, 2) : "-"}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-3">R 배수</p>
            <p className="tnum font-semibold">{preview.rMultiple != null ? `${preview.rMultiple.toFixed(2)}R` : "-"}</p>
          </div>
          <p className="col-span-3 text-[11px] text-ink-3">
            평단 ${fmtPrice(preview.avgEntry)} → ${fmtPrice(preview.avgExit)} · 최대 {preview.maxQty}주
            {preview.status === "closed" && ` · ${usd(preview.netPnl)}`}
          </p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="손절율 (%)">
          <PctInput sign="−" placeholder="예: 1.5" value={v.stopPct} onChange={(x) => set("stopPct", x)} />
          {prices?.stopPrice != null && <span className="tnum text-xs text-ink-3">→ ${fmtPrice(prices.stopPrice)}</span>}
        </Field>
        <Field label="목표율 (%)">
          <PctInput sign="+" placeholder="예: 3" value={v.targetPct} onChange={(x) => set("targetPct", x)} />
          {prices?.targetPrice != null && <span className="tnum text-xs text-ink-3">→ ${fmtPrice(prices.targetPrice)}</span>}
        </Field>
      </div>

      <Field label="적용 환율 (원/$)">
        <input
          className="input"
          inputMode="decimal"
          placeholder={autoFx ? `자동 ${autoFx.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : "자동"}
          value={v.fxRate}
          onChange={(e) => set("fxRate", e.target.value)}
        />
        <span className="text-xs text-ink-3">
          {autoFx
            ? autoFx.provisional
              ? "기준환율을 불러오지 못해 임시값입니다. 토스 체결 환율을 직접 입력하세요"
              : `비워두면 ${autoFx.rateDate} 기준환율(ECB) 적용 · 토스 적용 환율을 넣어도 됩니다`
            : "비워두면 거래일 기준환율 자동 적용"}
        </span>
      </Field>

      <Field label="셋업">
        <Chips options={settings.setupTags} selected={v.setupTags} onToggle={(t) => toggle("setupTags", t)} />
      </Field>

      <Field label="매수 사유">
        <textarea className="input min-h-20" placeholder="무엇을 보고 샀나요? (거래량, 돌파 레벨, 뉴스…)" value={v.entryReason} onChange={(e) => set("entryReason", e.target.value)} />
      </Field>
      <Field label="매도 사유">
        <textarea className="input min-h-20" placeholder="왜 팔았나요? (목표 도달, 손절, 흐름 약화…)" value={v.exitReason} onChange={(e) => set("exitReason", e.target.value)} />
      </Field>

      <Field label="감정 / 상태">
        <Chips options={settings.emotionTags} selected={v.emotionTags} onToggle={(t) => toggle("emotionTags", t)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="확신도">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="chip flex-1 !px-0" data-on={v.confidence === n} onClick={() => set("confidence", v.confidence === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="계획대로 했나요?">
          <div className="flex gap-1">
            {[
              [true, "예"],
              [false, "아니오"],
            ].map(([val, label]) => (
              <button key={String(val)} className="chip flex-1" data-on={v.followedPlan === val} onClick={() => set("followedPlan", v.followedPlan === val ? null : (val as boolean))}>
                {label as string}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="메모">
        <textarea className="input min-h-16" placeholder="복기, 배운 점" value={v.note} onChange={(e) => set("note", e.target.value)} />
      </Field>

      {error && <p className="rounded-lg bg-loss/15 px-3 py-2 text-sm text-ink">{error}</p>}
      <button className="btn btn-primary mb-4 w-full" onClick={submit} disabled={!!busy}>
        {busy ?? (positionId ? "수정 저장" : "저장")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      {children}
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (t: string) => void }) {
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((t) => (
        <button key={t} type="button" className="chip" data-on={selected.includes(t)} onClick={() => onToggle(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

function PctInput({ sign, placeholder, value, onChange }: { sign: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">{sign}</span>
      <input
        className="input !pr-8 !pl-7"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3">%</span>
    </div>
  );
}
