import { useState, useSyncExternalStore } from "react";
import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import { normalizeFood } from "../food";
import { getForbiddenKeys, subscribeForbidden, toggleForbidden } from "../forbidden";
import { editEntry, removeEntry } from "../store";
import { formatTime, fromLocalInput, toLocalInput } from "../ui/format";
import FoodInput from "./FoodInput";

export default function EntryItem({ entry }: { entry: Entry }) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [at, setAt] = useState(() => toLocalInput(entry.at));
  const forbiddenKeys = useSyncExternalStore(subscribeForbidden, getForbiddenKeys);

  function startEdit() {
    setText(entry.text);
    setAt(toLocalInput(entry.at));
    setEditing(true);
  }

  async function save() {
    if (!text.trim()) return;
    await editEntry(entry.id, { text: text.trim(), at: fromLocalInput(at) });
    setEditing(false);
  }

  async function remove() {
    if (confirm(t("deleteConfirm"))) await removeEntry(entry.id);
  }

  if (editing) {
    return (
      <li className="entry editing">
        <FoodInput value={text} onChange={setText} onSubmit={() => void save()} autoFocus />
        <div className="form-row">
          <input
            type="datetime-local"
            value={at}
            aria-label={t("timeLabel")}
            onChange={(e) => setAt(e.target.value)}
          />
          <span className="spacer" />
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            {t("cancel")}
          </button>
          <button className="btn-primary" onClick={() => void save()} disabled={!text.trim()}>
            {t("save")}
          </button>
        </div>
      </li>
    );
  }

  // каждая непустая строка текста — отдельная позиция приёма пищи
  const lines = entry.text.split("\n").filter((line) => line.trim() !== "");

  return (
    <li className="entry">
      {/* время встроено в линию-разделитель, текст записи занимает всю ширину */}
      <div className="entry-head">
        <time className="entry-time">{formatTime(entry.at, locale)}</time>
        <span className="entry-rule" aria-hidden="true" />
        <div className="entry-actions">
          <button className="icon-btn" aria-label={t("edit")} title={t("edit")} onClick={startEdit}>
            ✎
          </button>
          <button
            className="icon-btn danger"
            aria-label={t("delete")}
            title={t("delete")}
            onClick={() => void remove()}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="entry-text">
        {lines.map((line, i) => {
          const banned = forbiddenKeys.has(normalizeFood(line));
          return (
            <div key={i} className={"entry-line" + (banned ? " banned" : "")}>
              <span className="entry-line-text">{line}</span>
              <button
                className={"icon-btn ban-btn" + (banned ? " active" : "")}
                aria-label={banned ? t("allowAgain") : t("forbid")}
                title={banned ? t("allowAgain") : t("forbid")}
                onClick={() => void toggleForbidden(line)}
              >
                ⊘
              </button>
            </div>
          );
        })}
      </div>
    </li>
  );
}
