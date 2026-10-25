/**
 * db.js — שכבת אחסון מבוססת קובץ JSON יחיד.
 *
 * עקרונות:
 * 1. כל הנתונים מוחזקים בזיכרון, והדיסק משמש לשמירה מתמדת בלבד.
 * 2. כל שינוי מסונכרן (ללא await) על האובייקט שבזיכרון — Node חד-ת'רדי,
 *    ולכן שני בקשות לא יכולות "להתערבב" בתוך שלב השינוי.
 * 3. כתיבת הדיסק עוברת בתור (Promise chain) — כתיבה אחת בכל רגע.
 * 4. הכתיבה אטומית: קובץ זמני → fsync → rename. כך קובץ הנתונים לא נשאר חצי-כתוב.
 * 5. לפני כל החלפה נשמר גיבוי (db.json.bak), וממנו משחזרים במקרה של קובץ פגום.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const DB_PATH = config.dataFile;
const BACKUP_PATH = `${DB_PATH}.bak`;
const DB_DIR = path.dirname(DB_PATH);

/** האובייקט החי בזיכרון. נטען פעם אחת לפני שהשרת מתחיל להאזין. */
let data = null;

/** תור הכתיבות לדיסק — מבטיח שהן מתבצעות בסדר. */
let writeChain = Promise.resolve();

/** עטיפה לשגיאת קלט/פלט, כדי ה-middleware יזהה אותה ויחזיר 500 אחיד. */
function ioError(cause) {
  const err = new Error('io_error');
  err.code = 'io_error';
  err.cause = cause;
  return err;
}

/** יוצר אובייקט נתונים ריק — ללא נתוני דוגמה. */
function emptyDb() {
  return { version: 1, topics: [], sessions: [] };
}

/**
 * מנרמל ומנקה את הנתונים שנטענו מהדיסק.
 * - משליך רשומות פגומות במקום לקרוס.
 * - מטפל בזמן לא תקין (NaN) ובשדות חסרים.
 * - אוכף את הכלל: לכל נושא לכל היותר סשן פתוח אחד.
 * @param {unknown} parsed תוכן קובץ ה-JSON הגולמי
 * @returns {{ db: object, dropped: number, repaired: number }}
 */
function normalizeDb(parsed) {
  const db = emptyDb();
  let dropped = 0;
  let repaired = 0;

  if (!parsed || typeof parsed !== 'object') return { db, dropped, repaired };

  const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
  const validTopicIds = new Set();

  for (const t of rawTopics) {
    if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || !t.name.trim()) {
      dropped++;
      continue;
    }
    validTopicIds.add(t.id);
    db.topics.push({
      id: t.id,
      name: t.name,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    });
  }

  const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  // מיפוי topicId ⇒ הסשן הפתוח האחרון שלו (העתיקים ייסגרו באורך אפס).
  const openByTopic = new Map();
  const openSessions = [];

  for (const s of rawSessions) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      typeof s.topicId !== 'string' ||
      !validTopicIds.has(s.topicId) || // סשן יתום — נושאו נמחק
      typeof s.startTime !== 'string' ||
      Number.isNaN(Date.parse(s.startTime))
    ) {
      dropped++;
      continue;
    }
    const session = {
      id: s.id,
      topicId: s.topicId,
      startTime: new Date(Date.parse(s.startTime)).toISOString(),
      endTime: null,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : s.startTime,
      closedBy: null,
    };
    if (s.endTime !== null && s.endTime !== undefined && s.endTime !== '') {
      const endMs = Date.parse(s.endTime);
      // סיום לפני התחלה = תקלה בנתונים; מתקנים לסיום באורך אפס.
      session.endTime = Number.isNaN(endMs) ? session.startTime : new Date(endMs).toISOString();
      if (endMs < Date.parse(s.startTime)) {
        session.endTime = session.startTime;
        repaired++;
      }
      session.closedBy = s.closedBy === 'auto' ? 'auto' : 'user';
    } else {
      openSessions.push(session);
    }
    db.sessions.push(session);
  }

  // אכיפת "סשן פתוח אחד לכל נושא": שומרים את החדש, סוגרים את היתר באורך אפס.
  for (const s of openSessions) {
    const existing = openByTopic.get(s.topicId);
    if (!existing) {
      openByTopic.set(s.topicId, s);
      continue;
    }
    const [keep, close] = Date.parse(s.startTime) > Date.parse(existing.startTime) ? [s, existing] : [existing, s];
    close.endTime = close.startTime;
    close.closedBy = 'user';
    openByTopic.set(s.topicId, keep);
    repaired++;
  }

  return { db, dropped, repaired };
}

/**
 * שומר את הנתונים שבזיכרון לדיסק בצורה אטומית.
 * מיליון קריאות במקביל יבוצעו לפי סדר הקריאה.
 * @returns {Promise<void>}
 */
function persist() {
  const run = async () => {
    // snapshot נלקח בזמן הכתיבה עצמה, כך שהוא משקף את המצב העדכני.
    const json = JSON.stringify(data, null, 2);
    const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;

    await fs.mkdir(DB_DIR, { recursive: true });

    let handle;
    try {
      // גיבוי הקובץ הקיים לפני החלפתו — בכפיה קלה בלבד; כשל בגיבוי אינו עוצר.
      try {
        await fs.copyFile(DB_PATH, BACKUP_PATH);
      } catch (e) {
        if (e.code !== 'ENOENT') console.warn('[db] לא ניתן ליצור גיבוי:', e.message);
      }

      handle = await fs.open(tmpPath, 'w');
      await handle.writeFile(json, 'utf8');
      await handle.sync(); // הבטחת הנתונים על הדיסק לפני ה-rename
    } finally {
      // סגירת ה-handle תמיד, אחרת ב-Windows לא ניתן למחוק/להחליף את הקובץ.
      if (handle) await handle.close().catch(() => {});
    }

    // ב-Windows אנטי-וירוס או סנכרון OneDrive יכולים להחזיק את הקובץ לרגע.
    // rename אטומי באותה כונן; ניסיון חוזר קצר פותר את רוב המקרים.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmpPath, DB_PATH);
        return;
      } catch (e) {
        const retryable = e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'EACCES';
        if (!retryable || attempt >= 5) {
          await fs.unlink(tmpPath).catch(() => {});
          throw ioError(e);
        }
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }
  };

  // שרשור לתור: גם אם כתיבה קודמת נכשלה, הבאה עדיין תרוץ.
  const result = writeChain.then(run);
  writeChain = result.catch(() => {});
  return result;
}

/**
 * טוען את קובץ הנתונים. אם הקובץ חסר — יוצר אחד ריק.
 * אם הקובץ פגום — מעביר אותו לצד כגיבוי פגום ומנסה לשחזר מ-db.json.bak.
 * @returns {Promise<object>} הנתונים שנוטענו
 */
async function loadFromDisk() {
  await fs.mkdir(DB_DIR, { recursive: true });

  let raw;
  try {
    raw = await fs.readFile(DB_PATH, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw ioError(e);
    data = emptyDb();
    await persist();
    console.log(`[db] נוצר קובץ נתונים חדש: ${DB_PATH}`);
    return data;
  }

  try {
    const { db, dropped, repaired } = normalizeDb(JSON.parse(raw));
    data = db;
    if (dropped || repaired) {
      console.warn(`[db] נוקו ${dropped} רשומות פגומות ותוקנו ${repaired} סשנים`);
      await persist();
    }
    return data;
  } catch (parseError) {
    // הקובץ אינו JSON תקין — שומרים עותק שלו לפני כל החלפה.
    const corruptPath = `${DB_PATH}.corrupt-${Date.now()}`;
    await fs.copyFile(DB_PATH, corruptPath).catch(() => {});
    console.error(`[db] קובץ הנתונים פגום. עותק נשמר ב-${corruptPath}. מנסה שחזור מהגיבוי…`);

    try {
      const backupRaw = await fs.readFile(BACKUP_PATH, 'utf8');
      const { db, dropped, repaired } = normalizeDb(JSON.parse(backupRaw));
      data = db;
      await persist();
      console.warn(`[db] השחזור מהגיבוי הצליח (${dropped} רשומות נוקו, ${repaired} תוקנו).`);
      return data;
    } catch (backupError) {
      console.error('[db] השחזור מהגיבוי נכשל. ממשיכים עם מסד נתונים ריק.');
      data = emptyDb();
      await persist();
      return data;
    }
  }
}

/** טוען את הנתונים (פעם אחת, בשלב עליית השרת). */
export async function initDb() {
  if (data) return data;
  return loadFromDisk();
}

/** מחזיר את האובייקט החי שבזיכרון. מותר לקרוא ממנו בלבד. */
export function getData() {
  if (!data) throw new Error('db not initialized');
  return data;
}

/**
 * מבצע שינוי על הנתונים ושומר.
 * שלב השינוי חייב להיות סינכרוני — אין await בתוכו!
 * @template T
 * @param {(db: object) => T} mutator
 * @returns {Promise<T>} תוצאת השינוי
 */
export async function mutate(mutator) {
  if (!data) throw new Error('db not initialized');
  const result = mutator(data); // סינכרוני בכוונה — מונע מרוץ בין בקשות
  await persist();
  return result;
}

/** שומר את המצב הנוכחי (למשל לאחר סריקת סשנים שנסגרו אוטומטית). */
export async function persistCurrent() {
  await persist();
}

/** ממתין לסיום כל הכתיבות הבתור — לשימוש בכיבוי מסודר. */
export function flushWrites() {
  return writeChain;
}

// נתיבים חשופים לבדיקות ולתיעוד.
export const paths = { db: DB_PATH, backup: BACKUP_PATH };
