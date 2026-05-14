// utils/dateHelpers.js
// Uygulama genelinde DD/MM/YYYY formatı ile çalışır.
// Bu dosya parse, validate ve format işlevlerini merkezileştirir.

/** "DD/MM/YYYY" stringini Date objesine çevirir. Geçersizse null döner. */
export function parseDMY(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y || y < 2000 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  // Ay taşması kontrolü (örn. 31/02/2025 → geçersiz)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** "DD/MM/YYYY" formatının geçerli olup olmadığını kontrol eder. */
export function isValidDMY(str) {
  return parseDMY(str) !== null;
}

/** Date objesini "DD/MM/YYYY" formatına çevirir. */
export function formatDMY(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** İki "DD/MM/YYYY" stringini karşılaştırır (sıralama için). */
export function compareDMY(a, b) {
  const da = parseDMY(a);
  const db = parseDMY(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da - db;
}