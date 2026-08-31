import type { Notice } from "../App";
import { t, useLocale } from "../i18n";
import Menu from "./Menu";
import SyncStatus from "./SyncStatus";

export default function Header({
  onNotice,
  onPrint,
  onAiSettings
}: {
  onNotice: (n: Notice) => void;
  onPrint: () => void;
  onAiSettings: () => void;
}) {
  useLocale();
  return (
    <header className="header">
      <h1>{t("appTitle")}</h1>
      <div className="header-right">
        <SyncStatus />
        <Menu onNotice={onNotice} onPrint={onPrint} onAiSettings={onAiSettings} />
      </div>
    </header>
  );
}
