import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type RefObject
} from "react";
import {
  collectFoods,
  lineAt,
  otherLineKeys,
  replaceLine,
  suggestFoods,
  type FoodStat
} from "../food";
import { getForbiddenKeys, subscribeForbidden } from "../forbidden";
import { t, useLocale } from "../i18n";
import { getEntriesSnapshot, subscribeEntries } from "../store";
import { useAutoGrow } from "../ui/useAutoGrow";

/**
 * Поле ввода еды с автоподсказкой по уже записанному. Подсказки строятся для
 * той строки, в которой стоит курсор (строка = одна позиция приёма пищи), и
 * появляются, только когда курсор в конце строки — иначе подстановка целой
 * строки была бы неожиданной. ↑↓ выбирают, Enter/Tab подставляют, Esc прячет.
 */
export default function FoodInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  taRef: externalRef,
  onFocus
}: {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+Enter — отправка формы */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  taRef?: RefObject<HTMLTextAreaElement | null>;
  onFocus?: () => void;
}) {
  useLocale();
  const taRef = useAutoGrow(externalRef);
  const listId = useId();
  const entries = useSyncExternalStore(subscribeEntries, getEntriesSnapshot);
  const forbiddenKeys = useSyncExternalStore(subscribeForbidden, getForbiddenKeys);
  const foods = useMemo(() => collectFoods(entries), [entries]);

  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(-1);
  // список появляется только в ответ на ввод: открытая форма правки его не показывает
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(!!autoFocus);
  // курсор после подстановки ставим уже по обновлённому value — в layout-эффекте
  const pendingCaret = useRef<number | null>(null);

  const items = useMemo(() => {
    if (caret < 0) return []; // есть выделение — подсказывать нечего
    const line = lineAt(value, caret);
    // курсор не в конце строки — пользователь правит середину, не мешаем
    if (caret !== line.end || !line.value.trim()) return [];
    return suggestFoods(foods, line.value, { exclude: otherLineKeys(value, caret) });
  }, [foods, value, caret]);

  const open = focused && !hidden && items.length > 0;

  useLayoutEffect(() => {
    const el = taRef.current;
    if (el && pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  // выбранный стрелками пункт держим в видимой части списка
  useLayoutEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function accept(food: FoodStat) {
    const next = replaceLine(value, caret, food.text);
    pendingCaret.current = next.caret;
    setCaret(next.caret);
    setActive(-1);
    setHidden(true); // подставленное показывать в подсказках незачем
    onChange(next.text);
    taRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // без явного выбора стрелками Enter остаётся переводом строки — новая позиция
      e.preventDefault();
      accept(items[active]);
    } else if (e.key === "Tab" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      accept(items[active >= 0 ? active : 0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setHidden(true);
      setActive(-1);
    }
  }

  function syncCaret(el: HTMLTextAreaElement) {
    // выделение — не набор текста: подсказки прячем, чтобы не подменить выбранное
    const next = el.selectionStart === el.selectionEnd ? el.selectionStart : -1;
    // курсор не двигался (стрелка ушла в список) — выбранную подсказку не сбрасываем
    if (next === caret) return;
    setCaret(next);
    setActive(-1);
  }

  return (
    <div className="suggest-wrap">
      <textarea
        ref={taRef}
        value={value}
        rows={2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setCaret(e.target.selectionStart);
          setActive(-1);
          setHidden(false);
          onChange(e.target.value);
        }}
        onKeyUp={(e) => syncCaret(e.currentTarget)}
        onClick={(e) => syncCaret(e.currentTarget)}
        onFocus={(e) => {
          setFocused(true);
          setCaret(e.currentTarget.selectionStart);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="suggest" id={listId} role="listbox" aria-label={t("suggestLabel")}>
          {items.map((food, i) => {
            const banned = forbiddenKeys.has(food.key);
            return (
              <li
                key={food.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={
                  "suggest-item" + (i === active ? " active" : "") + (banned ? " banned" : "")
                }
                // фокус должен остаться в поле, иначе клик закроет список раньше себя
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => accept(food)}
              >
                <span className="suggest-text">{food.text}</span>
                {banned && (
                  <span className="suggest-ban" title={t("forbiddenTitle")} aria-hidden="true">
                    ⊘
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
