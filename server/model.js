/**
 * model.js — לוגיקה עסקית טהורה (ללא קריאות קלט/פלט וללא Express).
 *
 * הסשן הוא תקופת הרצה רציפה אחת של נושא:
 *   - "התחל" / "המשך"  ⇒ יצירת סשן חדש עם startTime בלבד (endTime = null).
 *   - "השהה"           ⇒ סגירת הסשן הפתוח (endTime = now).
 *   - "סה\"כ שעות"       ⇒ סכום משכי הסשנים הסגורים + הזמן שחלף בסשן הפתוח.
 *
 * אין טיימר לכל סשן. הזמן מחושב לפי הפרש תאריכים בלבד, ולכן השרת
 * עמיד בפני הפעלה מחדש, קריסה או היעדר לקוח.
 */
import { randomUUID } from 'node:crypto';
import { AUTO_CLOSE_MS, config } from './config.js';
import { AppError } from './errors.js';

/** קבועים עסקיים. */
export const LIMITS = {
  maxNameLength: config.maxTopicNameLength,
  historyDefaultLimit: 200,
  historyMaxLimit: 1000,
};

/** מזהה חדש עם קידומת לפי הסוג (t_ לנושא, s_ לסשן). */
const newId = (prefix) => `${prefix}${randomUUID()}`;

/** המרת מחרוזת ISO למילישניות, או 0 אם הייתה לא תקינה. */
function ms(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * סגירה אוטומטית של סשנים שפתוחים יותר מהמשך המקסימלי (AUTO_CLOSE_HOURS).
 * הסיום נקבע ל-startTime + המגבלה — ולא ל"עכשיו" — כדי לשמר את משמעות המגבלה.
 * הפונקציה אידמפוטנטית: סשן סגור כבר לא נוגעים בו.
 * @param {object} db
 * @param {number} nowMs הזמן הנוכחי במילישניות
 * @returns {object[]} הסשנים שנסגרו (ריק אם לא היו)
 */
export function autoCloseOpen(db, nowMs) {
  const closed = [];
  for (const s of db.sessions) {
    if (s.endTime !== null) continue;
    const startMs = ms(s.startTime);
    // שעון שחזר אחורה (NTP) — לא סוגרים, והזמן שחלף נחשב אפס.
    if (nowMs < startMs) continue;
    if (nowMs - startMs >= AUTO_CLOSE_MS) {
      s.endTime = new Date(startMs + AUTO_CLOSE_MS).toISOString();
      s.closedBy = 'auto';
      closed.push(s);
    }
  }
  return closed;
}

/**
 * אימות וניקוי שם נושא. מחזיר את השם המנורמל או זורק שגיאת 400.
 */
export function normalizeTopicName(rawName) {
  if (typeof rawName !== 'string') {
    throw new AppError(400, 'invalid_name', 'שם הנושא חייב להיות טקסט');
  }
  // הסרת תווי שליטה, נרמול Unicode, וקיצוץ רווחים מהקצוות.
  const name = rawName.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!name) {
    throw new AppError(400, 'invalid_name', 'שם הנושא לא יכול להיות ריק');
  }
  if (name.length > LIMITS.maxNameLength) {
    throw new AppError(400, 'invalid_name', `שם הנושא ארוך מדי (מקסימום ${LIMITS.maxNameLength} תווים)`);
  }
  return name;
}

/** חיפוש נושא לפי מזהה, או זריקת 404. */
export function findTopicOrThrow(db, topicId) {
  const topic = db.topics.find((t) => t.id === topicId);
  if (!topic) throw new AppError(404, 'topic_not_found', 'הנושא לא נמצא');
  return topic;
}

/** הסשן הפתוח של נושא, אם קיים. */
export function findOpenSession(db, topicId) {
  return db.sessions.find((s) => s.topicId === topicId && s.endTime === null) || null;
}

/**
 * יצירת נושא חדש. שינוי סינכרוני על ה-db — נקרא מתוך mutate().
 */
export function createTopic(db, rawName, nowMs) {
  const nowIso = new Date(nowMs).toISOString();
  const topic = { id: newId('t_'), name: normalizeTopicName(rawName), createdAt: nowIso };
  db.topics.push(topic);
  return topic;
}

/**
 * התחלת מעקב (או המשך לאחר השהיה) עבור נושא.
 * @throws {AppError} 409 אם הנושא כבר פעיל
 * @returns {{ topic: object, session: object }}
 */
export function startTopic(db, topicId, nowMs) {
  const topic = findTopicOrThrow(db, topicId);
  if (findOpenSession(db, topicId)) {
    throw new AppError(409, 'already_running', 'הנושא כבר פעיל');
  }
  const nowIso = new Date(nowMs).toISOString();
  const session = {
    id: newId('s_'),
    topicId,
    startTime: nowIso,
    endTime: null,
    createdAt: nowIso,
    closedBy: null,
  };
  db.sessions.push(session);
  return { topic, session };
}

/**
 * השהיית מעקב — סגירת הסשן הפתוח בזמן הנוכחי.
 * @throws {AppError} 409 אם הנושא אינו פעיל
 */
export function pauseTopic(db, topicId, nowMs) {
  const topic = findTopicOrThrow(db, topicId);
  const session = findOpenSession(db, topicId);
  if (!session) {
    throw new AppError(409, 'not_running', 'הנושא אינו פעיל כרגע');
  }
  // וידוא שהסיום לא קודם להתחלה (מקרה קצה של שעון).
  const endMs = Math.max(nowMs, ms(session.startTime));
  session.endTime = new Date(endMs).toISOString();
  session.closedBy = 'user';
  return { topic, session };
}

/**
 * מחיקת נושא וכל הסשנים שלו (כולל סשן פתוח).
 * ההחלטה אם לאשר את המחיקה נעשתה כבר באימות ה-PIN.
 */
export function deleteTopic(db, topicId) {
  findTopicOrThrow(db, topicId);
  const deletedSessionIds = db.sessions.filter((s) => s.topicId === topicId).map((s) => s.id);
  db.topics = db.topics.filter((t) => t.id !== topicId);
  db.sessions = db.sessions.filter((s) => s.topicId !== topicId);
  return { deletedTopicId: topicId, deletedSessionIds };
}

/**
 * מחיקת סשן בודד. אסורה על סשן פעיל — יש להשהות קודם.
 */
export function deleteSession(db, sessionId) {
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) throw new AppError(404, 'session_not_found', 'הרשומה לא נמצאה');
  if (session.endTime === null) {
    throw new AppError(409, 'session_running', 'לא ניתן למחוק סשן פעיל — יש להשהות אותו קודם');
  }
  db.sessions = db.sessions.filter((s) => s.id !== sessionId);
  return { deletedSessionId: sessionId };
}

/**
 * משך הסשן בשניות (עיגול כלפי מטה).
 * סשן פתוח מוגבל למשך המקסימלי, כדי שהתצוגה לא תחרוג ממה שהשרת יזכה בו.
 */
export function sessionDurationSeconds(session, nowMs) {
  const startMs = ms(session.startTime);
  const endMs = session.endTime === null
    ? Math.min(nowMs, startMs + AUTO_CLOSE_MS)
    : ms(session.endTime);
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/**
 * סכום השניות של כל הסשנים של נושא.
 */
export function topicTotalSeconds(db, topicId, nowMs) {
  let total = 0;
  for (const s of db.sessions) {
    if (s.topicId === topicId) total += sessionDurationSeconds(s, nowMs);
  }
  return total;
}

/**
 * בניית אובייקט התצוגה של נושא עבור הלקוח.
 * כל ערכי הזמן מחושבים בשרת זה עתה — הלקוח לא מחשב totals בעצמו.
 */
export function topicView(db, topic, nowMs) {
  const open = findOpenSession(db, topic.id);
  const sessionCount = db.sessions.reduce((n, s) => n + (s.topicId === topic.id ? 1 : 0), 0);
  return {
    id: topic.id,
    name: topic.name,
    createdAt: topic.createdAt,
    isRunning: Boolean(open),
    currentSessionId: open ? open.id : null,
    currentStartTime: open ? open.startTime : null,
    // משך הסשן הפעיל בשניות (0 כשאין סשן פתוח) — הלקוח מוסיף לו את הזמן שחלף
    // מאז התגובה, כדי להציג שעון "חי" בלי לחשב מחדש את הסה"כ כולו.
    sessionSeconds: open ? sessionDurationSeconds(open, nowMs) : 0,
    totalSeconds: topicTotalSeconds(db, topic.id, nowMs),
    sessionCount,
  };
}

/** בניית תצוגת סשן בודד (כולל שם הנושא). */
export function sessionView(db, session, nowMs, topicNameCache) {
  const topicName = topicNameCache?.get(session.topicId)
    ?? db.topics.find((t) => t.id === session.topicId)?.name
    ?? '[נושא]';
  return {
    id: session.id,
    topicId: session.topicId,
    topicName,
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds: sessionDurationSeconds(session, nowMs),
    isRunning: session.endTime === null,
    closedBy: session.closedBy,
  };
}

/** מפת topicId ⇒ שם, לחיסכון בחיפושים בעת בניית רשימת סשנים. */
export function buildTopicNameCache(db) {
  return new Map(db.topics.map((t) => [t.id, t.name]));
}

/**
 * רשימת סשנים מסוננת וממוינת לפי התחלה בסדר יורד.
 * @param {object} db
 * @param {number} nowMs
 * @param {{ topicId?: string, fromMs?: number|null, toMs?: number|null, limit?: number }} opts
 */
export function listSessionViews(db, nowMs, { topicId, fromMs = null, toMs = null, limit = LIMITS.historyDefaultLimit } = {}) {
  const names = buildTopicNameCache(db);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || LIMITS.historyDefaultLimit), LIMITS.historyMaxLimit);

  return db.sessions
    .filter((s) => {
      if (topicId && s.topicId !== topicId) return false;
      const startMs = ms(s.startTime);
      // from כולל, to בלעדי — כדי שהיסטוריה לפי ימים לא תכפיל רשומות בגבול.
      if (fromMs !== null && startMs < fromMs) return false;
      if (toMs !== null && startMs >= toMs) return false;
      return true;
    })
    .sort((a, b) => ms(b.startTime) - ms(a.startTime))
    .slice(0, safeLimit)
    .map((s) => sessionView(db, s, nowMs, names));
}
