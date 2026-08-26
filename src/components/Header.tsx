import { LOCALES, setLocale, t, useLocale } from "../i18n";
import SyncStatus from "./SyncStatus";

export default function Header() {
  const locale = useLocale();
  return (
    <header className="header">
      <h1>{t("appTitle")}</h1>
      <div className="header-right">
        {LOCALES.map((l) => (
          <button
            key={l}
            className={"lang" + (locale === l ? " active" : "")}
            onClick={() => setLocale(l)}
          >
            {l.toUpperCase()}
          </button>
        ))}
        <SyncStatus />
      </div>
    </header>
  );
}
