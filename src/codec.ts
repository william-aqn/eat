/**
 * Кодирование значений настроек для файла синхронизации: ключ API и прочее
 * не лежат в `entries.json` открытым текстом. Это base64, НЕ шифрование —
 * защита только от случайного взгляда, декодируется одной строкой.
 */
export function encodeSetting(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

export function decodeSetting(encoded: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  } catch {
    // битое значение из повреждённого файла не должно ронять приложение
    return "";
  }
}
