import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { applyToDocument } from "./i18n";
import { refreshFromDb, setMutateHook } from "./store";
import { loadSyncMeta, scheduleSync, sync } from "./sync";
import "./style.css";

applyToDocument();
registerSW({ immediate: true });

// Просим браузер не вытеснять IndexedDB (важно для iOS Safari)
navigator.storage?.persist?.().catch(() => {});

// Триггеры синхронизации: правки (debounce), выход в онлайн, возврат на вкладку, интервал
setMutateHook(() => scheduleSync());
window.addEventListener("online", () => void sync());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void sync();
});
setInterval(
  () => {
    if (!document.hidden) void sync();
  },
  5 * 60 * 1000
);

void (async () => {
  await refreshFromDb();
  await loadSyncMeta();
  void sync();
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
