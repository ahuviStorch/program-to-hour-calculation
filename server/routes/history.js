/**
 * routes/history.js — היסטוריית סשנים כוללת (כל הנושאים).
 * תומך בסינון לפי טווח תאריכים ובהגבלת מספר רשומות.
 */
import { Router } from 'express';
import { getData } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { LIMITS, listSessionViews } from '../model.js';

export const historyRouter = Router();

/**
 * ממיר פרמטר תאריך למספר מילישניות.
 *
 * שני פורמטים נתמכים:
 *   - יום בלבד (YYYY-MM-DD): חצות UTC. עבור 'to' מוסיפים יום שלם,
 *     כדי שכל הרשומות של אותו יום ייכללו (טווח חצי-פתוח [from, to+1d)).
 *   - חותמת ISO מלאה: נקבעת במדויק כפי שהיא, בלי תוספת —
 *     הלקוח כבר שולח את גבול היום בעצמו.
 * ערך ריק ⇒ null (ללא סינון).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateParam(value, { endOfDay = false } = {}) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') return NaN;

  const isDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = Date.parse(isDayOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed)) return NaN;

  return endOfDay && isDayOnly ? parsed + DAY_MS : parsed;
}

/** GET /api/history?from=ISO&to=ISO&limit=N */
historyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const fromMs = parseDateParam(req.query.from);
    const toMs = parseDateParam(req.query.to, { endOfDay: true });
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new AppError(400, 'invalid_query', 'טווח התאריכים אינו תקין');
    }

    const limitRaw = req.query.limit;
    let limit = LIMITS.historyDefaultLimit;
    if (limitRaw !== undefined) {
      limit = Number(limitRaw);
      if (!Number.isFinite(limit) || limit < 1) {
        throw new AppError(400, 'invalid_query', 'ערך limit אינו תקין');
      }
    }

    const db = getData();
    const now = Date.now();
    res.json({
      serverTime: new Date(now).toISOString(),
      items: listSessionViews(db, now, { fromMs, toMs, limit }),
    });
  })
);
