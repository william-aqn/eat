import type { Entry, ForbiddenItem, SettingItem } from "../db";

/** Формат файла синхронизации в облаке; forbidden/settings необязательны для старых файлов */
export type SyncFile = {
  version: 1;
  entries: Entry[];
  forbidden?: ForbiddenItem[];
  /** настройки приложения; значения в base64, см. codec.ts */
  settings?: SettingItem[];
};

/**
 * Точка замены облачного хранилища: сейчас — скрытая папка приложения Google Диска,
 * потенциально — видимый файл (parents: ["root"] + scope drive.file) или Google Таблица.
 */
export interface RemoteStore {
  findFile(name: string): Promise<string | null>;
  create(name: string, data: SyncFile): Promise<string>;
  update(fileId: string, data: SyncFile): Promise<void>;
  download(fileId: string): Promise<SyncFile>;
}
