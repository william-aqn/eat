import { useSyncExternalStore } from "react";
import { getAuthState, login, logout, subscribeAuth } from "../auth";
import { getLocale, t, useLocale } from "../i18n";
import { getSyncState, subscribeSync, type SyncStatus as Status } from "../sync";

const DOT_CLASS: Record<Status, string> = {
  idle: "off",
  localOnly: "off",
  offline: "off",
  syncing: "busy",
  ok: "ok",
  error: "err"
};

const DOT_LABEL: Record<Status, "statusSynced" | "statusSyncing" | "statusError" | "statusOffline"> = {
  idle: "statusSynced",
  localOnly: "statusSynced",
  offline: "statusOffline",
  syncing: "statusSyncing",
  ok: "statusSynced",
  error: "statusError"
};

export default function SyncStatus() {
  useLocale();
  const auth = useSyncExternalStore(subscribeAuth, getAuthState);
  const sync = useSyncExternalStore(subscribeSync, getSyncState);

  if (auth.status === "signedOut") {
    return (
      <button className="btn-ghost" title={t("signInTitle")} onClick={login}>
        {t("signIn")}
      </button>
    );
  }

  if (auth.status === "needsReauth") {
    return (
      <button className="btn-ghost warn" title={t("signInTitle")} onClick={login}>
        {t("signInAgain")}
      </button>
    );
  }

  const title = sync.lastSyncedAt
    ? t("lastSync", { time: new Date(sync.lastSyncedAt).toLocaleString(getLocale()) })
    : t(DOT_LABEL[sync.status]);

  return (
    <span className="account" title={title}>
      <span className={`dot ${DOT_CLASS[sync.status]}`} role="status" aria-label={t(DOT_LABEL[sync.status])} />
      <span className="email">{auth.email}</span>
      <button className="btn-ghost" onClick={() => void logout()}>
        {t("signOut")}
      </button>
    </span>
  );
}
