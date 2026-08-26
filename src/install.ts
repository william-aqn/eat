// Установка PWA: значок на рабочем столе и запуск в отдельном окне без адресной строки.
// Chrome (Android/desktop) присылает beforeinstallprompt — событие надо перехватить
// и сохранить: системный диалог можно открыть только позже и только по жесту
// пользователя. iOS Safari событие не шлёт, там установка вручную через «Поделиться»,
// поэтому пункт меню там просто не появится.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
  }
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** Страница уже открыта как установленное приложение */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari не поддерживает display-mode
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

window.addEventListener("beforeinstallprompt", (e) => {
  // иначе Chrome сам решит, когда показать свою плашку
  e.preventDefault();
  deferred = e;
  emit();
});

window.addEventListener("appinstalled", () => {
  deferred = null;
  emit();
});

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getCanInstall = (): boolean => deferred !== null && !isStandalone();

/** Открывает системный диалог установки; true — пользователь согласился */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  // событие одноразовое: повторный prompt() на нём бросит исключение
  deferred = null;
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}
