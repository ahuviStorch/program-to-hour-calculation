/**
 * lib/format.js — פונקציות תצוגה אחידות לתאריכים ומשכי זמן.
 *
 * כל התאריכים מגיעים מהשרת כ-ISO (UTC) ומוצגים לפי אזור הזמן של הדפדפן,
 * באמצעות Intl עם locale 'he-IL'.
 */

const dateTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' });

const timeFormatter = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** ממיר ערך ISO ל-Date; מחזיר null אם לא תקין. */
const toDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * בונה חותמת ISO (UTC) משדה input[type=date].
 *
 * הערכים 'YYYY-MM-DD' מומרים לחצות או לסוף היום (23:59:59.999) לפי שעון הדפדפן,
 * ואז לפורמט ISO של UTC — כך הסינון בשרת תואם למה שהמשתמש רואה בתצוגה.
 * מחזיר '' אם הערך ריק או לא תקין.
 */
export function toUtcBoundary(value, endOfDay = false) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** האם שתי חותמות זמן נופלות באותו יום (לפי אזור הזמן המקומי). */
export function isSameLocalDay(aIso, bIso) {
  const a = toDate(aIso);
  const b = toDate(bIso);
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** תאריך ושעה מלאים, למשל "22.10.2026, 14:03". */
export function formatDateTime(iso) {
  const d = toDate(iso);
  return d ? dateTimeFormatter.format(d) : '—';
}

/** תאריך בלבד. */
export function formatDate(iso) {
  const d = toDate(iso);
  return d ? dateFormatter.format(d) : '—';
}

/** שעה בלבד, בפורמט 24 שעות. */
export function formatTime(iso) {
  const d = toDate(iso);
  return d ? timeFormatter.format(d) : '—';
}

/**
 * משך בשניות → "HH:MM:SS".
 * השעות אינן מוגבלות ל-24, ומרופדות לפחות בשתי ספרות.
 */
export function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * תצוגה מקוצרת בעברית: "3 שע' 12 דק'".
 * נוחה בכרטיסי נושאים שבהם רוצים לקרוא את הסה"כ בקלות.
 */
export function formatDurationShort(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0 && minutes === 0) {
    return safe > 0 ? 'פחות מדקה' : '0 דק\'';
  }
  const parts = [];
  if (hours > 0) parts.push(`${hours} שע'`);
  parts.push(`${minutes} דק'`);
  return parts.join(' ');
}

/** תצוגת תאריך עבור שדה input[type=date]: YYYY-MM-DD לפי זמן מקומי. */
export function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
