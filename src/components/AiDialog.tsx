import { useEffect, useId, useState } from "react";
import { DEFAULT_MODEL, fetchModels } from "../ai";
import { t, useLocale } from "../i18n";
import { AI_KEY, AI_MODEL, getSettingsSnapshot, setSetting } from "../settings";

/** Настройки ИИ-оценки калорий: ключ OpenRouter и модель */
export default function AiDialog({ onClose }: { onClose: () => void }) {
  useLocale();
  const listId = useId();
  const [key, setKey] = useState(() => getSettingsSnapshot().get(AI_KEY) ?? "");
  const [model, setModel] = useState(() => getSettingsSnapshot().get(AI_MODEL) ?? "");
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    // список моделей — только подсказка: офлайн поле остаётся обычным текстовым
    fetchModels().then(setModels).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    await setSetting(AI_KEY, key);
    await setSetting(AI_MODEL, model);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-label={t("aiSettings")}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{t("aiSettings")}</h2>
        <label className="dialog-row">
          <span>{t("aiKeyLabel")}</span>
          <input
            type="password"
            value={key}
            autoFocus
            autoComplete="off"
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label className="dialog-row">
          <span>{t("aiModelLabel")}</span>
          <input
            type="text"
            value={model}
            placeholder={DEFAULT_MODEL}
            list={listId}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id={listId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <p className="dialog-hint">
          {t("aiKeyHint")}{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">
            {t("aiGetKey")} ↗
          </a>
        </p>
        <div className="form-row">
          <span className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn-primary" onClick={() => void save()}>
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
