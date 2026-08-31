import { useMemo, useSyncExternalStore } from "react";
import type { Entry } from "../db";
import { normalizeFood } from "../food";
import { getForbiddenKeys, getForbiddenSnapshot, subscribeForbidden } from "../forbidden";
import { t, useLocale } from "../i18n";
import { dayLabelPrint, formatTime, groupForPrint, type PrintRange } from "../ui/format";

/**
 * Печатная версия дневника: на экране скрыта (.psheet), в @media print видна
 * только она. Дни идут от старых к новым — листы можно допечатывать к прошлым.
 */
export default function PrintSheet({
  entries,
  range,
  kcal
}: {
  entries: Entry[];
  range: PrintRange | null;
  kcal: boolean;
}) {
  const locale = useLocale();
  const forbidden = useSyncExternalStore(subscribeForbidden, getForbiddenSnapshot);
  const forbiddenKeys = useSyncExternalStore(subscribeForbidden, getForbiddenKeys);

  const groups = useMemo(() => groupForPrint(entries, range), [entries, range]);

  return (
    <div className="psheet">
      <h1 className="psheet-title">{t("appTitle")}</h1>
      {forbidden.length > 0 && (
        <p className="psheet-forbidden">
          <strong>{t("forbiddenTitle")}:</strong> {forbidden.map((f) => f.text).join(", ")}
        </p>
      )}
      <div className="pcolumns">
        {groups.map((g) => (
          <section key={g.day} className="pday">
            <h2 className="pday-label">{dayLabelPrint(g.day, locale)}</h2>
            {g.items.map((e) => (
              <div key={e.id} className="pentry">
                <time className="pentry-time">
                  {formatTime(e.at, locale)}
                  {kcal && typeof e.kcal === "number" && (
                    <span className="pentry-kcal">{t("kcalApprox", { n: e.kcal })}</span>
                  )}
                </time>
                <div>
                  {e.text
                    .split("\n")
                    .filter((line) => line.trim() !== "")
                    .map((line, i) => {
                      const banned = forbiddenKeys.has(normalizeFood(line));
                      return (
                        <div key={i} className={"pentry-line" + (banned ? " banned" : "")}>
                          {/* знак вне зачёркивания: перечёркнутый ⊘ читается хуже */}
                          {banned && <span aria-hidden="true">⊘ </span>}
                          <span className="pentry-text">{line}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
