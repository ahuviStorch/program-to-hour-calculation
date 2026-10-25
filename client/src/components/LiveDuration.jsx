/**
 * LiveDuration — ספירת זמן חיה.
 *
 * עיקרון: השרת הוא מקור האמת. מקבלים ממנו סה"כ שניות ברגע טעינה,
 * ומוסיפים עליו את הזמן שחלף מאז — לאחר תיקון הפרש השעונים
 * בין הלקוח לשרת (skewMs).
 *
 * כדי שהתצוגה לא תחרוג ממה שהשרת באמת יספור:
 *   - ספירת הסשן נעצרת במגבלת הסגירה האוטומטית (autoCloseSeconds).
 *   - לאחר מכן מתבצע רענון מהשרת, שמחזיר את הערך המדויק.
 */
import { formatDuration } from '../lib/format.js';

/**
 * @param {{
 *   baseSeconds: number,       סה"כ שניות לפי השרת ברגע הטעינה
 *   sessionSeconds: number,    שניות בסשן הפעיל בלבד (0 אם אינו פעיל)
 *   fetchedAt: number,         Date.now() של הלקוח ברגע הטעינה
 *   skewMs: number,            שעת השרת פחות שעת הלקוח
 *   now: number,               Date.now() העדכני מהשעון המשותף
 *   autoCloseSeconds: number,  מגבלת אורך סשן בודד
 *   running: boolean,          האם הסשן פעיל כעת
 *   className?: string,
 * }} props
 */
export default function LiveDuration({
  baseSeconds,
  sessionSeconds,
  fetchedAt,
  skewMs,
  now,
  autoCloseSeconds,
  running,
  className = '',
}) {
  const serverNow = now + skewMs;
  const elapsed = fetchedAt > 0 ? Math.max(0, (serverNow - fetchedAt) / 1000) : 0;

  let seconds = baseSeconds;
  if (running) {
    // הסשן הפעיל לא יכול לעבור את המגבלה — השרת סוגר אותו שם
    const session = Math.min(sessionSeconds + elapsed, autoCloseSeconds);
    seconds = baseSeconds - sessionSeconds + session;
  }

  const clamped = running && sessionSeconds + elapsed >= autoCloseSeconds;

  return (
    <span
      className={`font-mono tabular-nums ${className}`}
      title={clamped ? 'המעקב ייסגר אוטומטית לאחר המגבלה שהוגדרה' : undefined}
    >
      {formatDuration(seconds)}
    </span>
  );
}
