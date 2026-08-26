import { useMemo, useState, useSyncExternalStore } from "react";
import DayGroup from "./components/DayGroup";
import EntryForm from "./components/EntryForm";
import Header from "./components/Header";
import { t, useLocale } from "./i18n";
import { getEntriesSnapshot, subscribeEntries } from "./store";
import { exportJson, groupByDay } from "./ui/format";

export default function App() {
  useLocale();
  const entries = useSyncExternalStore(subscribeEntries, getEntriesSnapshot);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  // Разовые уведомления после OAuth-редиректа (/?auth=denied|error)
  const [notice, setNotice] = useState<string | null>(() => {
    const p = new URLSearchParams(location.search).get("auth");
    if (p) history.replaceState(null, "", "/");
    return p;
  });

  return (
    <div className="app">
      <Header />
      {notice && (
        <div className="notice" role="alert" onClick={() => setNotice(null)}>
          {t(notice === "denied" ? "authDenied" : "authError")}
        </div>
      )}
      <EntryForm />
      {groups.length === 0 ? (
        <p className="empty">{t("emptyState")}</p>
      ) : (
        groups.map((g) => <DayGroup key={g.day} day={g.day} items={g.items} />)
      )}
      <footer className="footer">
        <button className="btn-ghost" onClick={() => exportJson(entries)}>
          {t("exportJson")}
        </button>
      </footer>
    </div>
  );
}
