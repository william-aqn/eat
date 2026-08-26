import { useState } from "react";
import type { Entry } from "../db";
import { t, useLocale } from "../i18n";
import { editEntry, removeEntry } from "../store";
import { formatTime, fromLocalInput, toLocalInput } from "../ui/format";

export default function EntryItem({ entry }: { entry: Entry }) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [at, setAt] = useState(() => toLocalInput(entry.at));

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
        <textarea value={text} rows={2} autoFocus onChange={(e) => setText(e.target.value)} />
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

  return (
    <li className="entry">
      <time className="entry-time">{formatTime(entry.at, locale)}</time>
      <div className="entry-text">{entry.text}</div>
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
    </li>
  );
}
