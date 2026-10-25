/**
 * routes/sessions.js — מחיקת סשן בודד.
 *
 * נתיב מחיקת הסשן מוטמע תחת /api/sessions (כלומר DELETE /api/sessions/:id).
 * נתיב היסטוריית הסשנים של נושא נתון מוגדר ב-topics.js, תחת
 * GET /api/topics/:id/sessions — כדי שכל נתיבי הנושא יישארו באותו ראוטר
 * ולא ייווצר נתיב כפול.
 */
import { Router } from 'express';
import { mutate } from '../db.js';
import { asyncHandler } from '../errors.js';
import { requireDeletePin } from '../pin.js';
import { deleteSession } from '../model.js';

export const sessionsRouter = Router();

/**
 * DELETE /api/sessions/:id — מחיקת רשומה בודדת מההיסטוריה.
 * מחייב PIN. סשן פעיל לא נמחק (409) — יש להשהות אותו קודם.
 */
sessionsRouter.delete(
  '/:id',
  requireDeletePin,
  asyncHandler(async (req, res) => {
    const result = await mutate((db) => deleteSession(db, req.params.id));
    res.json(result);
  })
);
