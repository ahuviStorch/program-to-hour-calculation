/**
 * config.js — טעינה ואימות של הגדרות הסביבה.
 *
 * כל ההגדרות נקראות פעם אחת בעת עליית השרת ונבדקות כאן,
 * כך שכל שאר המודולים מקבלים ערכים תקינים ובטוחים לשימוש.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// שורש הפרויקט — מחושב מתוך מיקום הקובץ הנוכחי (server/config.js ⇒ שורש),
// ולא מתוך process.cwd(), כדי שהנתיב לקובץ הנתונים יהיה תמיד יציב.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ממיר מחרוזת מהסביבה למספר, ומחיל ברירת מחדל אם הערך חסר או לא תקין.
 * @param {string|undefined} raw ערך גולמי מהסביבה
 * @param {number} fallback ערך ברירת מחדל
 * @returns {number} מספר סופי
 */
function toNumber(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * בודק שערך נמצא בטווח. אם לא — עוצר את השרת עם הודעה ברורה,
 * כדי שלא נפעל עם הגדרה שגויה שמסתירה תקלה.
 */
function requireRange(name, value, min, max, { minExclusive = false } = {}) {
  const belowMin = minExclusive ? value <= min : value < min;
  if (belowMin || value > max || Number.isNaN(value)) {
    console.error(`[config] ערך לא תקין עבור ${name}: ${value} (נדרש בין ${min} ל-${max})`);
    process.exit(1);
  }
  return value;
}

const deletePin = String(process.env.DELETE_PIN ?? '');

// PIN חלש מדי (או חסר) הופך את הגנת המחיקה לחסרת משמעות — לכן לא עולים בכלל.
if (deletePin.trim().length < 4) {
  console.error(
    '[config] DELETE_PIN חסר או קצר מדי. יש להגדיר בקובץ .env קוד של 4 תווים לפחות.'
  );
  process.exit(1);
}

// אזהרה בולטת כאשר משתמשים ב-PIN ברירת המחדל של הדוגמה.
if (deletePin === '1234') {
  console.warn('[config] שימו לב: DELETE_PIN הוא עדיין ברירת המחדל (1234). מומלץ להחליפו.');
}

export const config = {
  projectRoot: PROJECT_ROOT,
  port: requireRange('PORT', toNumber(process.env.PORT, 3001), 1, 65535),
  // נתיב מוחלט תמיד — בין אם הוגדר יחסית לשורש הפרויקט ובין אם כנתיב מוחלט.
  dataFile: path.resolve(PROJECT_ROOT, process.env.DATA_FILE || 'data/db.json'),
  // מפתחות המחיקה מושווים כ-Hash; לא שומרים את ה-PIN בטקסט גלוי בזיכרון מעבר לנדרש.
  deletePin: deletePin.normalize('NFC'),
  autoCloseHours: requireRange(
    'AUTO_CLOSE_HOURS',
    toNumber(process.env.AUTO_CLOSE_HOURS, 6),
    0,
    24,
    { minExclusive: true }
  ),
  sweepMinutes: requireRange('SWEEP_MINUTES', toNumber(process.env.SWEEP_MINUTES, 15), 0.1, 1440),
  pinMaxFails: requireRange('PIN_MAX_FAILS', toNumber(process.env.PIN_MAX_FAILS, 5), 1, 100),
  pinLockMs: requireRange('PIN_LOCK_MS', toNumber(process.env.PIN_LOCK_MS, 600_000), 1_000, 86_400_000),
  // מקסימום אורך שם נושא — מוגן גם בצד השרת, לא רק בטופס.
  maxTopicNameLength: 60,
};

// משך הסשן המרבי במילישניות — בשימוש במודל ובסריקת הרקע.
export const AUTO_CLOSE_MS = Math.round(config.autoCloseHours * 60 * 60 * 1000);
