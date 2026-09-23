import type { Bucket, Stats } from "./stats";
import { formatHold } from "./time";

export interface Insight {
  kind: "strength" | "weakness";
  title: string;
  detail: string;
}

const MIN_SAMPLE = 5;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const usd = (x: number) => `${x < 0 ? "-" : ""}$${Math.abs(x).toFixed(2)}`;

function bestWorst(buckets: Bucket[]) {
  const ok = buckets.filter((b) => b.count >= MIN_SAMPLE);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => b.avgPnl - a.avgPnl);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

/** 통계로부터 규칙 기반 장단점을 뽑는다. AI 리포트의 입력으로도 쓰인다. */
export function deriveInsights(stats: Stats): Insight[] {
  const s = stats.summary;
  const out: Insight[] = [];
  if (s.count < MIN_SAMPLE) return out;

  if (s.profitFactor != null && s.profitFactor >= 1.5)
    out.push({ kind: "strength", title: "수익 구조가 좋음", detail: `Profit Factor ${s.profitFactor.toFixed(2)} (1.5 이상이면 우수)` });
  if (s.payoff != null && s.payoff < 1 && s.winRate < 0.6)
    out.push({
      kind: "weakness",
      title: "손익비가 낮음",
      detail: `평균 이익 ${usd(s.avgWin)} < 평균 손실 ${usd(s.avgLoss)} (손익비 ${s.payoff.toFixed(2)}). 승률 ${pct(s.winRate)}로는 보완이 어렵습니다.`,
    });
  if (s.avgHoldWin && s.avgHoldLoss && s.avgHoldLoss > s.avgHoldWin * 1.5)
    out.push({
      kind: "weakness",
      title: "손실 포지션을 오래 버팀",
      detail: `손실 매매 평균 보유 ${formatHold(s.avgHoldLoss)} vs 이익 매매 ${formatHold(s.avgHoldWin)}`,
    });
  if (s.avgLoss < 0 && s.largestLoss < s.avgLoss * 3)
    out.push({
      kind: "weakness",
      title: "큰 손실 한 방",
      detail: `최대 손실 ${usd(s.largestLoss)}이 평균 손실의 ${(s.largestLoss / s.avgLoss).toFixed(1)}배. 손절 규칙 점검 필요.`,
    });

  const tod = bestWorst(stats.breakdowns.timeOfDay);
  if (tod) {
    if (tod.best.avgPnl > 0)
      out.push({ kind: "strength", title: `강한 시간대: ${tod.best.label}`, detail: `${tod.best.count}건, 승률 ${pct(tod.best.winRate)}, 평균 ${usd(tod.best.avgPnl)}` });
    if (tod.worst.avgPnl < 0)
      out.push({ kind: "weakness", title: `약한 시간대: ${tod.worst.label}`, detail: `${tod.worst.count}건, 승률 ${pct(tod.worst.winRate)}, 평균 ${usd(tod.worst.avgPnl)}` });
  }

  const setup = bestWorst(stats.breakdowns.setup.filter((b) => b.key !== "(태그 없음)"));
  if (setup) {
    if (setup.best.avgPnl > 0)
      out.push({ kind: "strength", title: `잘 맞는 셋업: ${setup.best.label}`, detail: `${setup.best.count}건, 승률 ${pct(setup.best.winRate)}, 합계 ${usd(setup.best.netPnl)}` });
    if (setup.worst.avgPnl < 0)
      out.push({ kind: "weakness", title: `안 맞는 셋업: ${setup.worst.label}`, detail: `${setup.worst.count}건, 승률 ${pct(setup.worst.winRate)}, 합계 ${usd(setup.worst.netPnl)}` });
  }

  const late = stats.breakdowns.tradeNumber.filter((b) => ["4번째", "5번째", "6번째 이후"].includes(b.key));
  const lateN = late.reduce((a, b) => a + b.count, 0);
  const lateNet = late.reduce((a, b) => a + b.netPnl, 0);
  if (lateN >= MIN_SAMPLE && lateNet < 0)
    out.push({ kind: "weakness", title: "과매매 경향", detail: `하루 4번째 이후 매매 ${lateN}건 합계 ${usd(lateNet)}. 하루 매매 횟수 제한을 고려하세요.` });

  const revenge = stats.breakdowns.afterPrev.find((b) => b.key === "손실 직후 15분 내 재진입");
  if (revenge && revenge.count >= 3 && revenge.avgPnl < 0)
    out.push({ kind: "weakness", title: "복수매매 신호", detail: `손실 직후 15분 내 재진입 ${revenge.count}건, 승률 ${pct(revenge.winRate)}, 합계 ${usd(revenge.netPnl)}` });

  for (const e of stats.breakdowns.emotion)
    if (e.key !== "(태그 없음)" && e.count >= 3 && e.netPnl < 0)
      out.push({ kind: "weakness", title: `감정 태그 '${e.label}'일 때 손실`, detail: `${e.count}건, 합계 ${usd(e.netPnl)}` });

  const off = stats.breakdowns.followedPlan.find((b) => b.key === "계획 이탈");
  const on = stats.breakdowns.followedPlan.find((b) => b.key === "계획대로");
  if (off && off.count >= 3 && off.avgPnl < (on?.avgPnl ?? 0))
    out.push({ kind: "weakness", title: "계획 이탈 비용", detail: `계획 이탈 ${off.count}건 평균 ${usd(off.avgPnl)} vs 계획대로 평균 ${usd(on?.avgPnl ?? 0)}` });

  const ex = stats.excursion;
  if (ex.count >= MIN_SAMPLE) {
    if (ex.avgPostExitHighWin != null && ex.avgPostExitHighWin > 0.01)
      out.push({ kind: "weakness", title: "조기 익절 경향", detail: `이익 매매 매도 후 30분 내 평균 ${pct(ex.avgPostExitHighWin)} 추가 상승` });
    if (ex.lossesThatWereGreen >= 3)
      out.push({ kind: "weakness", title: "이익을 손실로 돌려줌", detail: `한때 +0.5% 이상이던 매매 ${ex.lossesThatWereGreen}건이 손실로 끝남. 본전 스탑/부분 익절을 고려하세요.` });
    if (ex.chase.count >= 3 && ex.chase.avgPnl < 0)
      out.push({ kind: "weakness", title: "추격매수 손실", detail: `진입 전 10분 +2% 이상 오른 뒤 산 매매 ${ex.chase.count}건, 평균 ${usd(ex.chase.avgPnl)}` });
    if (ex.avgMaeWin != null && ex.avgMaeWin > -0.003)
      out.push({ kind: "strength", title: "진입 타이밍이 정확함", detail: `이익 매매의 평균 역행폭 ${pct(ex.avgMaeWin)}로 작음` });
  }
  return out;
}
