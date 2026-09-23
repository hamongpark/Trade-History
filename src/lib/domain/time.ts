import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const ET = "America/New_York";
export const KST = "Asia/Seoul";

/** 미국 동부시간 기준 거래일 (YYYY-MM-DD) */
export function etDate(d: Date): string {
  return formatInTimeZone(d, ET, "yyyy-MM-dd");
}

/** 로컬 날짜(YYYY-MM-DD) + 시각(HH:mm) 을 해당 타임존으로 해석해 UTC Date 로 변환 */
export function localToUtc(date: string, time: string, tz: string): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, tz);
}

export function fmt(d: Date, tz: string, pattern = "HH:mm"): string {
  return formatInTimeZone(d, tz, pattern);
}

/** ET 기준 하루 중 분 (0~1439) */
export function etMinuteOfDay(d: Date): number {
  const [h, m] = formatInTimeZone(d, ET, "H:m").split(":").map(Number);
  return h * 60 + m;
}

export function etWeekday(d: Date): number {
  return Number(formatInTimeZone(d, ET, "i")); // 1=월 … 7=일
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 주어진 날짜가 속한 주의 월요일 (YYYY-MM-DD) */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  return addDays(date, -dow);
}

export function formatHold(seconds: number | null): string {
  if (seconds == null) return "-";
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}
