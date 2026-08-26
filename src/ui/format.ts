import type { Entry } from "../db";

export function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupByDay(entries: Entry[]): { day: number; items: Entry[] }[] {
  const groups = new Map<number, Entry[]>();
  for (const e of entries) {
    const key = dayStart(e.at);
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  return [...groups.entries()]
    .map(([day, items]) => ({ day, items: items.sort((a, b) => b.at - a.at) }))
    .sort((a, b) => b.day - a.day);
}

export function dayLabel(day: number, locale: string, todayText: string, yesterdayText: string): string {
  const today = dayStart(Date.now());
  if (day === today) return todayText;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (day === y.getTime()) return yesterdayText;
  const d = new Date(day);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" })
  }).format(d);
}

export function formatTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(ms);
}

/** epoch ms → значение для <input type="datetime-local"> в локальном времени */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}

export function exportJson(entries: Entry[]): void {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `food-diary-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
