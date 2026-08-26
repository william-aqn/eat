import { useState, useSyncExternalStore } from "react";
import { getForbiddenSnapshot, subscribeForbidden, unmarkForbidden } from "../forbidden";
import { t, useLocale } from "../i18n";

/** Выпадающий список продуктов, которые доктор запретил; пуст — не показывается */
export default function ForbiddenList() {
  useLocale();
  const items = useSyncExternalStore(subscribeForbidden, getForbiddenSnapshot);
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <section className={"forbidden" + (open ? " open" : "")}>
      <button className="forbidden-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">⊘</span> {t("forbiddenTitle")} ({items.length})
        <span className="forbidden-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      <ul className="forbidden-list">
        {items.map((f) => (
          <li key={f.id} className="forbidden-item">
            <span className="forbidden-text">{f.text}</span>
            <button
              className="icon-btn"
              aria-label={t("allowAgain")}
              title={t("allowAgain")}
              onClick={() => void unmarkForbidden(f.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
