import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import DayGroup from "./components/DayGroup";
import EntryForm from "./components/EntryForm";
import Header from "./components/Header";
import { t, useLocale, type Dict } from "./i18n";
import { getEntriesSnapshot, importEntries, subscribeEntries } from "./store";
import { exportJson, groupByDay, parseImportFile } from "./ui/format";

type Notice = {
  key: keyof Dict;
  vars?: Record<string, string | number>;
  tone?: "ok" | "warn";
};

export default function App() {
  useLocale();
  const entries = useSyncExternalStore(subscribeEntries, getEntriesSnapshot);
  const groups = useMemo(() => groupByDay(entries), [entries]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Разовые уведомления: после OAuth-редиректа (/?auth=denied|error) и результат импорта
  const [notice, setNotice] = useState<Notice | null>(() => {
    const p = new URLSearchParams(location.search).get("auth");
    if (p) history.replaceState(null, "", "/");
    return p ? { key: p === "denied" ? "authDenied" : "authError", tone: "warn" } : null;
  });

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // позволяет выбрать тот же файл повторно
    if (!file) return;
    try {
      const { entries: parsed } = parseImportFile(await file.text());
      const { applied } = await importEntries(parsed);
      setNotice(
        applied
          ? { key: "importDone", vars: { applied, total: parsed.length }, tone: "ok" }
          : { key: "importNone", tone: "ok" }
      );
    } catch {
      setNotice({ key: "importError", tone: "warn" });
    }
  }

  return (
    <div className="app">
      <Header />
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
      <footer className="footer">
        <button className="btn-ghost" onClick={() => exportJson(entries)}>
          {t("exportJson")}
        </button>
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
          {t("importJson")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void onImportFile(e)}
        />
      </footer>
    </div>
  );
}
