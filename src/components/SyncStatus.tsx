import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "../auth";
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

/** Точка статуса синхронизации в шапке; управление аккаунтом — в бургер-меню */
export default function SyncStatus() {
  useLocale();
  const auth = useSyncExternalStore(subscribeAuth, getAuthState);
  const sync = useSyncExternalStore(subscribeSync, getSyncState);

  if (auth.status === "signedOut") return null;

  if (auth.status === "needsReauth") {
    return <span className="dot err" role="status" aria-label={t("signInAgain")} title={t("signInAgain")} />;
  }

  const title = sync.lastSyncedAt
    ? t("lastSync", { time: new Date(sync.lastSyncedAt).toLocaleString(getLocale()) })
    : t(DOT_LABEL[sync.status]);

  return (
    <span
      className={`dot ${DOT_CLASS[sync.status]}`}
      role="status"
      aria-label={t(DOT_LABEL[sync.status])}
      title={title}
    />
  );
}
