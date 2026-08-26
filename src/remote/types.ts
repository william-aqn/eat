import type { Entry } from "../db";

/** Формат файла синхронизации в облаке */
export type SyncFile = {
  version: 1;
  entries: Entry[];
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
