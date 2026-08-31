import type { Entry } from "./db";

/**
 * Нормализация названия — она же id продукта: «Салат  Мимоза» и «салат мимоза»
 * считаются одним продуктом, поэтому пометка с разных устройств сливается сама.
 */
export function normalizeFood(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Название в исходном написании, но без лишних пробелов — для показа */
export function cleanFood(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export type FoodStat = {
  /** нормализованное название — ключ продукта */
  key: string;
  /** написание из самой свежей записи */
  text: string;
  /** сколько раз встречалось в дневнике */
  count: number;
  /** когда встречалось последний раз, epoch ms */
  lastAt: number;
};

/** Частое и свежее — выше */
function byRank(a: FoodStat, b: FoodStat): number {
  return b.count - a.count || b.lastAt - a.lastAt || a.key.localeCompare(b.key);
}

/**
 * Словарь уже съеденного: каждая непустая строка записи — отдельная позиция,
 * повторы схлопываются по normalizeFood.
 */
export function collectFoods(entries: Entry[]): FoodStat[] {
  const map = new Map<string, FoodStat>();
  for (const e of entries) {
    if (e.deleted) continue;
    for (const line of e.text.split("\n")) {
      const key = normalizeFood(line);
      if (!key) continue;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { key, text: cleanFood(line), count: 1, lastAt: e.at });
      } else {
        cur.count++;
        // написание показываем то, которым записали в последний раз
        if (e.at > cur.lastAt) {
          cur.lastAt = e.at;
          cur.text = cleanFood(line);
        }
      }
    }
  }
  return [...map.values()].sort(byRank);
}

/** Совпадение с начала названия важнее совпадения с начала слова, оно — важнее любого вхождения */
function matchTier(key: string, q: string): number {
  if (key.startsWith(q)) return 0;
  const at = key.indexOf(q);
  if (at < 0) return -1;
  return key[at - 1] === " " ? 1 : 2;
}

export const SUGGEST_LIMIT = 6;

/**
 * Подсказки к набранной строке. Отсекаем то, что уже набрано целиком, и то,
 * что уже есть в соседних строках этой же записи (exclude).
 */
export function suggestFoods(
  foods: FoodStat[],
  query: string,
  options: { exclude?: ReadonlySet<string>; limit?: number } = {}
): FoodStat[] {
  const q = normalizeFood(query);
  if (!q) return [];
  const { exclude, limit = SUGGEST_LIMIT } = options;
  const ranked: { food: FoodStat; tier: number }[] = [];
  for (const food of foods) {
    if (food.key === q || exclude?.has(food.key)) continue;
    const tier = matchTier(food.key, q);
    if (tier >= 0) ranked.push({ food, tier });
  }
  ranked.sort((a, b) => a.tier - b.tier || byRank(a.food, b.food));
  return ranked.slice(0, limit).map((r) => r.food);
}

export type Line = { start: number; end: number; value: string };

/** Строка, в которой стоит курсор: строка textarea = одна позиция еды */
export function lineAt(text: string, caret: number): Line {
  const pos = Math.max(0, Math.min(caret, text.length));
  // lastIndexOf с отрицательной позицией смотрит на индекс 0 — в начале текста ищем не его
  const start = pos === 0 ? 0 : text.lastIndexOf("\n", pos - 1) + 1;
  const nl = text.indexOf("\n", pos);
  const end = nl === -1 ? text.length : nl;
  return { start, end, value: text.slice(start, end) };
}

/** Подстановка подсказки: текущая строка заменяется целиком, курсор — в её конец */
export function replaceLine(
  text: string,
  caret: number,
  replacement: string
): { text: string; caret: number } {
  const line = lineAt(text, caret);
  return {
    text: text.slice(0, line.start) + replacement + text.slice(line.end),
    caret: line.start + replacement.length
  };
}

/** Ключи остальных строк записи — одну и ту же позицию дважды не предлагаем */
export function otherLineKeys(text: string, caret: number): Set<string> {
  const cur = lineAt(text, caret);
  const keys = new Set<string>();
  let pos = 0;
  for (const raw of text.split("\n")) {
    if (pos !== cur.start) {
      const key = normalizeFood(raw);
      if (key) keys.add(key);
    }
    pos += raw.length + 1;
  }
  return keys;
}
