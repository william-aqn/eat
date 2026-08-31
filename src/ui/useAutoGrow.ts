import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Авторазмер textarea: высота растёт под содержимое, пока CSS max-height
 * не остановит — дальше обычный скролл. Пересчёт на каждом рендере (без
 * массива зависимостей): textarea может впервые появиться в DOM с уже
 * готовым текстом (режим редактирования), когда value не менялся.
 *
 * Внешний ref принимается, чтобы владелец поля (форма, фокусирующая его
 * после добавления) и хук работали с одним и тем же элементом.
 */
export function useAutoGrow(external?: RefObject<HTMLTextAreaElement | null>) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = external ?? own;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight не включает границы, а height при border-box — включает
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  });
  return ref;
}
