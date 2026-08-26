import type { Dict } from "./en";

const ru = {
  appTitle: "Дневник питания",
  addPlaceholder: "Что вы съели?",
  add: "Добавить",
  timeLabel: "Время приёма пищи",
  today: "Сегодня",
  yesterday: "Вчера",
  edit: "Изменить",
  delete: "Удалить",
  save: "Сохранить",
  cancel: "Отмена",
  deleteConfirm: "Удалить запись?",
  signIn: "Войти",
  signInTitle: "Войдите через Google, чтобы синхронизировать записи между устройствами",
  signOut: "Выйти",
  signInAgain: "Войти заново",
  emptyState: "Пока пусто. Запишите первый приём пищи.",
  exportJson: "Экспорт JSON",
  authDenied: "Вход отменён",
  authError: "Не удалось войти. Попробуйте ещё раз.",
  lastSync: "Синхронизировано: {time}",
  statusSynced: "Синхронизировано",
  statusSyncing: "Синхронизация…",
  statusError: "Ошибка синхронизации",
  statusOffline: "Офлайн — изменения сохраняются локально",
  ctrlEnterHint: "Ctrl+Enter — добавить"
} satisfies Dict;

export default ru;
