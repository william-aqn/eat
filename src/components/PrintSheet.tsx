import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import type { Entry } from "../db";
import { getForbiddenKeys, getForbiddenSnapshot, normalizeFood, subscribeForbidden } from "../forbidden";
import { t, useLocale } from "../i18n";
import {
  dayLabelPrint,
  formatDateShort,
  formatTime,
  groupForPrint,
  type PrintRange
} from "../ui/format";

/**
 * Печатная версия дневника: на экране скрыта (.psheet), в @media print видна
 * только она. Дни идут от старых к новым — листы можно допечатывать к прошлым.
 */
export default function PrintSheet({ entries, range }: { entries: Entry[]; range: PrintRange | null }) {
  const locale = useLocale();
  const forbidden = useSyncExternalStore(subscribeForbidden, getForbiddenSnapshot);
  const forbiddenKeys = useSyncExternalStore(subscribeForbidden, getForbiddenKeys);

  // Перед печатью синхронно перерисовываем, чтобы «Распечатано: …» было актуальным
  const [, bump] = useState(0);
  useEffect(() => {
    const onBeforePrint = () => flushSync(() => bump((x) => x + 1));
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  const groups = useMemo(() => groupForPrint(entries, range), [entries, range]);

  return (
    <div className="psheet">
      <h1 className="psheet-title">{t("appTitle")}</h1>
      <p className="psheet-meta">
        {groups.length > 0 && (
          <>
            {formatDateShort(groups[0].day, locale)} —{" "}
            {formatDateShort(groups[groups.length - 1].day, locale)} ·{" "}
          </>
        )}
        {t("printedOn")}: {new Date().toLocaleString(locale)}
      </p>
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
                <time className="pentry-time">{formatTime(e.at, locale)}</time>
                <div>
                  {e.text
                    .split("\n")
                    .filter((line) => line.trim() !== "")
                    .map((line, i) => (
                      <div key={i} className="pentry-line">
                        {forbiddenKeys.has(normalizeFood(line)) && "⊘ "}
                        {line}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
