import { useRef, useState } from "react";
import { t, useLocale } from "../i18n";
import { addEntry } from "../store";
import { fromLocalInput, toLocalInput } from "../ui/format";

export default function EntryForm() {
  useLocale();
  const [text, setText] = useState("");
  const [at, setAt] = useState(() => toLocalInput(Date.now()));
  const [timeTouched, setTimeTouched] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!text.trim()) return;
    await addEntry(text, fromLocalInput(at));
    setText("");
    setAt(toLocalInput(Date.now()));
    setTimeTouched(false);
    taRef.current?.focus();
  }

  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        ref={taRef}
        value={text}
        rows={2}
        placeholder={t("addPlaceholder")}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          // форма могла стоять открытой долго — освежаем время, пока его не трогали
          if (!text && !timeTouched) setAt(toLocalInput(Date.now()));
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="form-row">
        <input
          type="datetime-local"
          value={at}
          aria-label={t("timeLabel")}
          onChange={(e) => {
            setAt(e.target.value);
            setTimeTouched(true);
          }}
        />
        <span className="spacer" />
        <button className="btn-primary" type="submit" disabled={!text.trim()} title={t("ctrlEnterHint")}>
          {t("add")}
        </button>
      </div>
    </form>
  );
}
