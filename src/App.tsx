import { useMemo, useState, useSyncExternalStore } from "react";
import DayGroup from "./components/DayGroup";
import EntryForm from "./components/EntryForm";
import Header from "./components/Header";
import { t, useLocale, type Dict } from "./i18n";
import { getEntriesSnapshot, subscribeEntries } from "./store";
import { groupByDay } from "./ui/format";

export type Notice = {
  key: keyof Dict;
  vars?: Record<string, string | number>;
  tone?: "ok" | "warn";
};

export default function App() {
  useLocale();
  const entries = useSyncExternalStore(subscribeEntries, getEntriesSnapshot);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  // Разовые уведомления: после OAuth-редиректа (/?auth=denied|error) и результат импорта
  const [notice, setNotice] = useState<Notice | null>(() => {
    const p = new URLSearchParams(location.search).get("auth");
    if (p) history.replaceState(null, "", "/");
    return p ? { key: p === "denied" ? "authDenied" : "authError", tone: "warn" } : null;
  });

  return (
    <div className="app">
      <Header onNotice={setNotice} />
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
      {groups.length === 0 ? (
        <p className="empty">{t("emptyState")}</p>
      ) : (
        groups.map((g) => <DayGroup key={g.day} day={g.day} items={g.items} />)
      )}
    </div>
  );
}
