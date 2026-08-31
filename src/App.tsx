import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import AiDialog from "./components/AiDialog";
import DayGroup from "./components/DayGroup";
import EntryForm from "./components/EntryForm";
import Footer from "./components/Footer";
import ForbiddenList from "./components/ForbiddenList";
import Header from "./components/Header";
import PrintDialog, { readPrintKcal } from "./components/PrintDialog";
import PrintSheet from "./components/PrintSheet";
import { t, useLocale, type Dict } from "./i18n";
import { getEntriesSnapshot, subscribeEntries } from "./store";
import { groupByDay, type PrintRange } from "./ui/format";

export type Notice = {
  key: keyof Dict;
  vars?: Record<string, string | number>;
  tone?: "ok" | "warn";
};

export default function App() {
  useLocale();
  const entries = useSyncExternalStore(subscribeEntries, getEntriesSnapshot);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  // Разовые уведомления (результат импорта и т.п.)
  const [notice, setNotice] = useState<Notice | null>(null);

  // Настройки ИИ-оценки калорий (ключ OpenRouter и модель)
  const [aiOpen, setAiOpen] = useState(false);

  // Печать: из меню — диалог выбора диапазона дней; после печати диапазон
  // сбрасывается, чтобы Ctrl+P предсказуемо печатал весь дневник
  const [printOpen, setPrintOpen] = useState(false);
  const [printRange, setPrintRange] = useState<PrintRange | null>(null);
  // калории, в отличие от диапазона, после печати не сбрасываем: галочка —
  // постоянная настройка, её же берёт Ctrl+P без диалога
  const [printKcal, setPrintKcal] = useState(readPrintKcal);
  useEffect(() => {
    const onAfterPrint = () => setPrintRange(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  function printRangeNow(range: PrintRange, withKcal: boolean) {
    // синхронный коммит: настройки должны попасть в DOM до открытия окна печати
    flushSync(() => {
      setPrintOpen(false);
      setPrintRange(range);
      setPrintKcal(withKcal);
    });
    window.print();
  }

  return (
    <>
      <div className="app">
        <Header
          onNotice={setNotice}
          onPrint={() => setPrintOpen(true)}
          onAiSettings={() => setAiOpen(true)}
        />
        {notice && (
          <div
            className={"notice" + (notice.tone === "ok" ? " ok" : "")}
            role="alert"
            onClick={() => setNotice(null)}
          >
            {t(notice.key, notice.vars)}
          </div>
        )}
        <EntryForm />
        <ForbiddenList />
        {groups.length === 0 ? (
          <p className="empty">{t("emptyState")}</p>
        ) : (
          groups.map((g) => (
            <DayGroup key={g.day} day={g.day} items={g.items} onNotice={setNotice} />
          ))
        )}
        {printOpen && (
          <PrintDialog entries={entries} onClose={() => setPrintOpen(false)} onPrint={printRangeNow} />
        )}
        {aiOpen && <AiDialog onClose={() => setAiOpen(false)} />}
      </div>
      <PrintSheet entries={entries} range={printRange} kcal={printKcal} />
      <Footer />
    </>
  );
}
