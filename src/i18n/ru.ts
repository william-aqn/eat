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
  importJson: "Импорт JSON",
  importDone: "Импортировано записей: {applied} из {total}",
  importNone: "Нового нет — всё уже в дневнике",
  importError: "Не удалось импортировать файл",
  lastSync: "Синхронизировано: {time}",
  statusSynced: "Синхронизировано",
  statusSyncing: "Синхронизация…",
  statusError: "Ошибка синхронизации",
  statusOffline: "Офлайн — изменения сохраняются локально",
  ctrlEnterHint: "Ctrl+Enter — добавить",
  menu: "Меню",
  print: "Печать",
  printedOn: "Распечатано",
  backToBlog: "На блог"
} satisfies Dict;

export default ru;
