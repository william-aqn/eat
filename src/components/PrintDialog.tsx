import { useEffect, useMemo, useState } from "react";
import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import {
  dayStart,
  formatDateShort,
  fromDateInput,
  toDateInput,
  type PrintRange
} from "../ui/format";

/** yyyy-mm-dd последнего напечатанного дня — следующая печать продолжит с завтрашнего */
const LS_PRINTED_TO = "fd.printedTo";

function readPrintedTo(): string | null {
  const v = localStorage.getItem(LS_PRINTED_TO);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Следующий день через setDate — прибавление 86400000 мс ломается на переводе часов */
function nextDay(value: string): number {
  const d = new Date(fromDateInput(value));
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export default function PrintDialog({
  entries,
  onPrint,
  onClose
}: {
  entries: Entry[];
  onPrint: (range: PrintRange) => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const [printedTo] = useState(readPrintedTo);
  const [fromStr, setFromStr] = useState(() => {
    const today = dayStart(Date.now());
    // продолжение прошлой печати; если её не было — с самой старой записи
    if (printedTo) return toDateInput(Math.min(nextDay(printedTo), today));
    const oldest = entries.reduce((min, e) => Math.min(min, e.at), Infinity);
    return toDateInput(Number.isFinite(oldest) ? dayStart(oldest) : today);
  });
  const [toStr, setToStr] = useState(() => toDateInput(Date.now()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fromMs = fromStr ? fromDateInput(fromStr) : NaN;
  const toMs = toStr ? fromDateInput(toStr) : NaN;
  const valid = Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs <= toMs;
  const count = useMemo(() => {
    if (!valid) return 0;
    return entries.filter((e) => {
      const d = dayStart(e.at);
      return d >= fromMs && d <= toMs;
    }).length;
  }, [entries, valid, fromMs, toMs]);

  function submit() {
    if (!valid || count === 0) return;
    localStorage.setItem(LS_PRINTED_TO, toStr);
    onPrint({ from: fromMs, to: toMs });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label={t("print")} onClick={(e) => e.stopPropagation()}>
        <h2>{t("print")}</h2>
        <label className="dialog-row">
          <span>{t("printFrom")}</span>
          <input
            type="date"
            value={fromStr}
            autoFocus
            onChange={(e) => setFromStr(e.target.value)}
          />
        </label>
        <label className="dialog-row">
          <span>{t("printTo")}</span>
          <input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} />
        </label>
        {printedTo && (
          <p className="dialog-hint">
            {t("printLast", { date: formatDateShort(fromDateInput(printedTo), locale) })}
          </p>
        )}
        <p className="dialog-hint">{t("printEntries", { n: count })}</p>
        <div className="form-row">
          <span className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!valid || count === 0}>
            {t("print")}
          </button>
        </div>
      </div>
    </div>
  );
}
