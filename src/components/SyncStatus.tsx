import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "../auth";
import { getLocale, t, useLocale } from "../i18n";
import { getSyncState, subscribeSync, type SyncStatus as Status } from "../sync";

const DOT_CLASS: Record<Status, string> = {
  idle: "off",
  localOnly: "off",
  needsAuth: "off",
  offline: "off",
  syncing: "busy",
  ok: "ok",
  error: "err"
};

const DOT_LABEL: Record<
  Status,
  "statusSynced" | "statusSyncing" | "statusError" | "statusOffline" | "statusNeedsAuth"
> = {
  idle: "statusSynced",
  localOnly: "statusSynced",
  needsAuth: "statusNeedsAuth",
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

  // жёлтая точка: есть правки, не доехавшие до облака (кроме момента самой синхронизации)
  const dirty = !!sync.dirty && sync.status !== "syncing";
  const labelKey = dirty
    ? sync.status === "needsAuth"
      ? "statusNeedsAuth"
      : "statusDirty"
    : DOT_LABEL[sync.status];
  const title =
    !dirty && sync.lastSyncedAt
      ? t("lastSync", { time: new Date(sync.lastSyncedAt).toLocaleString(getLocale()) })
      : t(labelKey);

  return (
    <span
      className={`dot ${dirty ? "warn" : DOT_CLASS[sync.status]}`}
      role="status"
      aria-label={t(labelKey)}
      title={title}
    />
  );
}
