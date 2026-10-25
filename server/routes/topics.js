/**
 * routes/topics.js — נקודות הקצה של נושאים: רשימה, יצירה, התחלה, השהיה, מחיקה.
 *
 * דפוס זהה בכל Handler:
 *   1. סגירה אוטומטית של סשנים שפג תוקפם (על ידי middleware ב-index.js).
 *   2. שינוי על ה-db בתוך mutate() — סינכרוני ואז שמירה אטומית לדיסק.
 *   3. החזרת "תצוגה" מחושבת של הנושא (totals מעודכנים בזמן התגובה).
 */
import { Router } from 'express';
import { getData, mutate } from '../db.js';
import { asyncHandler } from '../errors.js';
import { requireDeletePin } from '../pin.js';
import {
  createTopic,
  deleteTopic,
  findTopicOrThrow,
  listSessionViews,
  pauseTopic,
  startTopic,
  topicView,
} from '../model.js';

export const topicsRouter = Router();

/** GET /api/topics — רשימת כל הנושאים עם סה"כ שעות. */
topicsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getData();
    const now = Date.now();
    res.json({ serverTime: new Date(now).toISOString(), topics: db.topics.map((t) => topicView(db, t, now)) });
  })
);

/** POST /api/topics — יצירת נושא חדש. גוף הבקשה: { name }. */
topicsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const topic = await mutate((db) => createTopic(db, req.body?.name, now));
    res.status(201).json(topicView(getData(), topic, now));
  })
);

/** POST /api/topics/:id/start — התחלה או המשך מעקב. */
topicsRouter.post(
  '/:id/start',
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const { topic } = await mutate((db) => startTopic(db, req.params.id, now));
    res.json(topicView(getData(), topic, now));
  })
);

/** POST /api/topics/:id/pause — השהיית מעקב (סגירת הסשן הפתוח). */
topicsRouter.post(
  '/:id/pause',
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const { topic } = await mutate((db) => pauseTopic(db, req.params.id, now));
    res.json(topicView(getData(), topic, now));
  })
);

/**
 * DELETE /api/topics/:id — מחיקת נושא וכל ההיסטוריה שלו.
 * מחייב PIN; מוגן בשיעור ניסיונות. אימות ה-PIN מתבצע לפני בדיקת הקיום.
 */
topicsRouter.delete(
  '/:id',
  requireDeletePin,
  asyncHandler(async (req, res) => {
    const result = await mutate((db) => deleteTopic(db, req.params.id));
    res.json(result);
  })
);

/**
 * GET /api/topics/:id/sessions — כל הרשומות של נושא, מהחדש לישן.
 * מוגבל ל-1000 רשומות (הגבול העליון של ההיסטוריה).
 */
topicsRouter.get(
  '/:id/sessions',
  asyncHandler(async (req, res) => {
    const db = getData();
    findTopicOrThrow(db, req.params.id); // 404 אם הנושא לא קיים
    const now = Date.now();
    res.json({
      serverTime: new Date(now).toISOString(),
      items: listSessionViews(db, now, { topicId: req.params.id, limit: 1000 }),
    });
  })
);

/** GET /api/topics/:id — נושא בודד (לשימוש עתידי ולבדיקות). */
topicsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getData();
    const topic = findTopicOrThrow(db, req.params.id);
    res.json(topicView(db, topic, Date.now()));
  })
);
