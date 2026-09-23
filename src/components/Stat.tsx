export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-semibold">{value}</p>
      {sub && <p className="tnum text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}
