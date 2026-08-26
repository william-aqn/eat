import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Notice } from "../App";
import { getAccessToken, getAuthState, login, logout, subscribeAuth } from "../auth";
import { LOCALES, setLocale, t, useLocale } from "../i18n";
import { getCanInstall, promptInstall, subscribeInstall } from "../install";
import { getEntriesSnapshot, importEntries } from "../store";
import { sync } from "../sync";
import { exportJson, parseImportFile } from "../ui/format";

export default function Menu({ onNotice }: { onNotice: (n: Notice) => void }) {
  const locale = useLocale();
  const auth = useSyncExternalStore(subscribeAuth, getAuthState);
  const canInstall = useSyncExternalStore(subscribeInstall, getCanInstall);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // input живёт вне выпадающей части: событие change не должно теряться при закрытии меню
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // позволяет выбрать тот же файл повторно
    if (!file) return;
    try {
      const { entries: parsed } = parseImportFile(await file.text());
      const { applied } = await importEntries(parsed);
      onNotice(
        applied
          ? { key: "importDone", vars: { applied, total: parsed.length }, tone: "ok" }
          : { key: "importNone", tone: "ok" }
      );
    } catch {
      onNotice({ key: "importError", tone: "warn" });
    }
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        className="icon-btn burger"
        aria-label={t("menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void onImportFile(e)}
      />
      {open && (
        <div className="menu" role="menu">
          <div className="menu-langs">
            {LOCALES.map((l) => (
              <button
                key={l}
                className={"lang" + (locale === l ? " active" : "")}
                onClick={() => setLocale(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          {auth.status === "signedIn" ? (
            <>
              <div className="menu-email" title={auth.email ?? ""}>
                {auth.email}
              </div>
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  // токен живёт ~час и продлевается только по клику: если протух,
                  // сначала вход (клик — жест пользователя, попап не заблокируют),
                  // затем sync() напрямую, минуя debounce у scheduleSync
                  void (async () => {
                    if (!getAccessToken() && !(await login())) return;
                    await sync();
                  })();
                }}
              >
                {t("syncNow")}
              </button>
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <button
              className={"menu-item" + (auth.status === "needsReauth" ? " warn" : "")}
              role="menuitem"
              title={t("signInTitle")}
              onClick={() => {
                setOpen(false);
                // клик — пользовательский жест: попап Google не будет заблокирован
                void login().then((ok) => {
                  if (ok) void sync();
                });
              }}
            >
              {t(auth.status === "needsReauth" ? "signInAgain" : "signIn")}
            </button>
          )}
          <div className="menu-sep" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              exportJson(getEntriesSnapshot());
            }}
          >
            {t("exportJson")}
          </button>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          >
            {t("importJson")}
          </button>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            {t("print")}
          </button>
          {canInstall && (
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void promptInstall();
              }}
            >
              {t("installApp")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
