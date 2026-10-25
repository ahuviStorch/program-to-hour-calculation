/**
 * pin.js — הגנת מחיקה באמצעות PIN.
 *
 * כל בקשת מחיקה מחייבת כותרת "x-delete-pin". השרת:
 *   1. בודק שהכותרת קיימת (אחרת 400) — בקשה בלי PIN אינה "ניחוש".
 *   2. בודק אם ה-IP בנעילה (אחרת 429 עם Retry-After).
 *   3. משווה את ה-PIN בזמן קבוע (timingSafeEqual על ערכי Hash באורך זהה).
 *   4. על כישלון — מגדיל מונה; בחריגה מהמקסימום — נועל את ה-IP לזמן מוגדר.
 *   5. על הצלחה — מאפס את המונה.
 *
 * ה-PIN עצמו לעולם לא נרשם בלוגים ולא מוחזר בתגובות.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { AppError } from './errors.js';

/** Hash באורך קבוע, כדי שההשוואה לא תחשוף את אורך ה-PIN. */
function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

const PIN_HASH = hash(config.deletePin);

/** ספריית מצב הניסיונות, לפי כתובת IP. מתאפסת באתחול מחדש של השרת. */
const attempts = new Map(); // ip ⇒ { fails: number, lockedUntil: number }

/** הגבלת מספר הרשומות במפה, כדי שלא תגדל ללא גבול. */
const MAX_TRACKED_IPS = 10_000;

/** כתובת ה-IP של הלקוח. בשרת מקומי זה בדרך כלל ::1 או 127.0.0.1. */
function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * מנקה רשומות שפג תוקפן, כדי שהמפה לא תצטבר.
 */
function pruneExpired(nowMs) {
  if (attempts.size < MAX_TRACKED_IPS) return;
  for (const [ip, entry] of attempts) {
    if (entry.lockedUntil < nowMs && entry.fails === 0) attempts.delete(ip);
    if (attempts.size < MAX_TRACKED_IPS / 2) break;
  }
}

/**
 * middleware שמוודא PIN תקין לפני מחיקה.
 * יש להרכיב אותו לפני הבדיקה האם הרשומה קיימת —
 * כך לא ניתן "למנות" מזהים בלי PIN.
 */
export function requireDeletePin(req, res, next) {
  const nowMs = Date.now();
  const ip = clientIp(req);
  pruneExpired(nowMs);

  const entry = attempts.get(ip) || { fails: 0, lockedUntil: 0 };

  // נעילה פעילה ⇒ 429 עם זמן המתנה.
  if (entry.lockedUntil > nowMs) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - nowMs) / 1000);
    attempts.set(ip, entry);
    return next(
      new AppError(429, 'pin_locked', 'יותר מדי ניסיונות שגויים. נסו שוב בעוד זמן מה', {
        retryAfterSeconds,
      })
    );
  }

  const header = req.get('x-delete-pin');
  if (typeof header !== 'string' || header.length === 0) {
    return next(new AppError(400, 'pin_required', 'נדרש קוד PIN למחיקה'));
  }

  // השוואה בזמן קבוע: אורך ה-Hash זהה תמיד, ולכן אין דליפת מידע.
  const ok = timingSafeEqual(hash(header.normalize('NFC')), PIN_HASH);

  if (ok) {
    attempts.delete(ip); // הצלחה מאפסת את המונה
    return next();
  }

  entry.fails += 1;
  if (entry.fails >= config.pinMaxFails) {
    entry.lockedUntil = nowMs + config.pinLockMs;
    entry.fails = 0; // המונה מתאפס; הנעילה עצמה מונעת ניסיונות
    attempts.set(ip, entry);
    return next(
      new AppError(429, 'pin_locked', 'יותר מדי ניסיונות שגויים. נסו שוב בעוד זמן מה', {
        retryAfterSeconds: Math.ceil(config.pinLockMs / 1000),
      })
    );
  }

  attempts.set(ip, entry);
  return next(new AppError(401, 'invalid_pin', 'קוד PIN שגוי'));
}
