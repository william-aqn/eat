/**
 * Оценка калорийности через OpenRouter прямо из браузера (CORS у них открыт,
 * бэкенд не нужен). Модуль чистый: ключ и модель приходят параметрами,
 * настройки живут в settings.ts.
 */

const API = "https://openrouter.ai/api/v1";

/**
 * Победитель замера 2026-08: правдоподобные оценки на всех пробах, ~0.4 с,
 * ~$0.0005 за 100 оценок. Рассуждающие модели (gpt-5-nano, qwen3) не брать:
 * жгут невидимые reasoning-токены — реальная цена в десятки раз выше заявленной.
 */
export const DEFAULT_MODEL = "mistralai/mistral-small-3.2-24b-instruct";

/**
 * Первое число из ответа модели; разделители тысяч («1 200», «1,200»)
 * схлопываются. Вне разумных пределов — null (модель ответила не тем).
 */
export function parseKcal(reply: string): number | null {
  const m = reply.match(/\d[\d ,\u00A0\u202F]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/\D/g, ""), 10);
  return n > 0 && n < 100_000 ? n : null;
}

export async function estimateCalories(
  text: string,
  opts: { apiKey: string; model?: string }
): Promise<number> {
  const r = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Estimate the total energy of the meal described by the user (any language). " +
            "Reply with ONLY one integer: the approximate total kilocalories (kcal). " +
            "No units, no ranges, no explanations."
        },
        { role: "user", content: text }
      ]
    })
  });
  if (!r.ok) {
    throw new Error(`openrouter ${r.status}: ${await r.text().catch(() => r.statusText)}`);
  }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const kcal = parseKcal(j.choices?.[0]?.message?.content ?? "");
  if (kcal === null) throw new Error("no_number_in_reply");
  return kcal;
}

let modelsCache: string[] | null = null;

/** Список моделей для подсказки в настройках; эндпоинт публичный, без ключа */
export async function fetchModels(): Promise<string[]> {
  if (modelsCache) return modelsCache;
  const r = await fetch(`${API}/models`);
  if (!r.ok) throw new Error(`openrouter ${r.status}`);
  const j = (await r.json()) as { data?: { id?: string }[] };
  modelsCache = (j.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => !!id)
    .sort();
  return modelsCache;
}
