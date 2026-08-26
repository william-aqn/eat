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

/** Метка дня для печати: всегда полная дата с годом (на бумаге «Сегодня» бессмысленно) */
export function dayLabelPrint(day: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(day));
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

/**
 * Разбор файла импорта. Принимает формат экспорта ({exportedAt, entries})
 * или голый массив записей; некорректные записи пропускаются.
 */
export function parseImportFile(text: string): { entries: Entry[]; skipped: number } {
  const data: unknown = JSON.parse(text);
  const raw = Array.isArray(data) ? data : (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(raw)) throw new Error("bad_format");

  const entries: Entry[] = [];
  let skipped = 0;
  for (const item of raw) {
    const r = item as Partial<Entry> | null;
    if (
      r &&
      typeof r.id === "string" &&
      r.id &&
      typeof r.text === "string" &&
      typeof r.at === "number" &&
      Number.isFinite(r.at)
    ) {
      const updatedAt =
        typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : r.at;
      entries.push({ id: r.id, text: r.text, at: r.at, updatedAt, deleted: r.deleted ? 1 : 0 });
    } else {
      skipped++;
    }
  }
  if (!entries.length && raw.length) throw new Error("no_valid_entries");
  return { entries, skipped };
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
