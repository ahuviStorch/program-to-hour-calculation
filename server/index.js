/**
 * index.js — נקודת הכניסה של השרת.
 *
 * סדר הפעולה:
 *   1. טעינת הנתונים וסגירה אוטומטית של סשנים שפג תוקפם (לפני שמתחילים להאזין).
 *   2. הגדרת Express, קידוד JSON, וסגירה אוטומטית לפני כל בקשת API.
 *   3. הרכבת נקודות הקצה ו-middleware השגיאות.
 *   4. הפעלת סריקת רקע תקופתית שסוגרת סשנים ישנים גם כשאין לקוח מחובר.
 *   5. הגשת ממשק הבנוי (במצב ייצור) וכיבוי מסודר.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { AUTO_CLOSE_MS, config } from './config.js';
import { flushWrites, getData, initDb, mutate } from './db.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { autoCloseOpen, topicView } from './model.js';
import { historyRouter } from './routes/history.js';
import { sessionsRouter } from './routes/sessions.js';
import { topicsRouter } from './routes/topics.js';

/**
 * סוגר סשנים פתוחים שחרגו מהמשך המקסימלי, ושומר לדיסק רק אם באמת היה שינוי.
 * אידמפוטנטי — מריצה חוזרת לא משנה דבר.
 * @returns {Promise<number>} מספר הסשנים שנסגרו
 */
async function runAutoClose() {
  const now = Date.now();
  const data = getData();
  // בדיקה מהירה ללא שינוי — מצב "אין מה לסגור" לא יגרום לכתיבה לדיסק.
  const expired = data.sessions.find(
    (s) => s.endTime === null && now >= Date.parse(s.startTime) + AUTO_CLOSE_MS
  );
  if (!expired) return 0;

  const closedCount = await mutate((db) => autoCloseOpen(db, now).length);
  if (closedCount > 0) console.log(`[auto-close] נסגרו ${closedCount} סשנים שחרגו מהמגבלה`);
  return closedCount;
}

/**
 * middleware: מבצע סגירה אוטומטית לפני כל בקשת API,
 * כך שתגובות הקריאה משקפות תמיד מצב עקבי.
 */
function autoCloseMiddleware(req, res, next) {
  runAutoClose().then(
    () => next(),
    (err) => next(err)
  );
}

async function start() {
  // 1. אתחול האחסון
  await initDb();

  // 2. סגירת סשנים פתוחים שכבר עברו את המגבלה (למשל אם השרת היה כבוי)
  const closedAtBoot = await runAutoClose();
  if (closedAtBoot) console.log(`[server] נסגרו ${closedAtBoot} סשנים שפג תוקפם באתחול`);

  const app = express();
  app.disable('x-powered-by');
  // מגבלת גודל גוף הבקשה — אין סיבה לקבל גופים גדולים בקריאה מקומית.
  app.use(express.json({ limit: '16kb' }));

  // --- API ---
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // סגירה אוטומטית לפני כל בקשה תחת /api
  app.use('/api', autoCloseMiddleware);

  // מצב מלא של האפליקציה — נקודת הטעינה היחידה של הלקוח.
  app.get('/api/state', (req, res) => {
    const db = getData();
    const now = Date.now();
    res.json({
      serverTime: new Date(now).toISOString(),
      autoCloseSeconds: Math.floor(AUTO_CLOSE_MS / 1000),
      topics: db.topics.map((t) => topicView(db, t, now)),
    });
  });

  app.use('/api/topics', topicsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/history', historyRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  // 3. הגשת ממשק הבנוי (אם קיים) — מאפשר הרצה בפורט אחד ללא Vite
  const clientDist = path.join(config.projectRoot, 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // Express 5: תו כללי בשם — כל GET שאינו API מוחזר ל-index.html (SPA).
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`[server] API פעיל בכתובת http://127.0.0.1:${config.port}`);
    console.log(`[server] קובץ נתונים: ${config.dataFile}`);
    console.log(`[server] סגירה אוטומטית לאחר ${config.autoCloseHours} שעות`);
    if (fs.existsSync(clientDist)) {
      console.log(`[server] הממשק הבנוי זמין בכתובת http://127.0.0.1:${config.port}`);
    }
  });

  // 4. סריקת רקע קלה — ללא טיימר לכל סשן, רק בדיקה תקופתית של הרשומות הפתוחות
  const sweep = setInterval(() => {
    runAutoClose().catch((err) => console.error('[sweep] שגיאה בסגירה אוטומטית:', err.message));
  }, config.sweepMinutes * 60_000);
  sweep.unref();

  // 5. כיבוי מסודר — מפסיקים לקבל בקשות וממתינים לכתיבות שבתור
  const shutdown = async (signal) => {
    console.log(`[server] התקבל ${signal} — סוגר…`);
    clearInterval(sweep);
    server.close(async () => {
      await flushWrites().catch(() => {});
      process.exit(0);
    });
    // גיבוי במקרה של בקשה תלויה
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] עליית השרת נכשלה:', err);
  process.exit(1);
});
