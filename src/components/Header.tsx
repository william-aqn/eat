import type { Notice } from "../App";
import { t, useLocale } from "../i18n";
import Menu from "./Menu";
import SyncStatus from "./SyncStatus";

export default function Header({ onNotice }: { onNotice: (n: Notice) => void }) {
  useLocale();
  return (
    <header className="header">
      <h1>{t("appTitle")}</h1>
      <div className="header-right">
        <SyncStatus />
        <Menu onNotice={onNotice} />
      </div>
    </header>
  );
}
