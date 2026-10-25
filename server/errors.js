/**
 * errors.js — מחלקת שגיאה אחידה, עוטף ל-Handler אסינכרוני, ו-middleware לשגיאות.
 *
 * כל השגיאות מוחזרות ללקוח במבנה אחיד:
 *   { "error": { "code": "...", "message": "..." } }
 * ה-code יציב (הלקוח מסתמך עליו), וה-message מיועד להצגה למשתמש.
 */

/**
 * שגיאה "עסקית" שהשרת מחזיר ללקוח עם קוד HTTP וקוד שגיאה מוגדרים.
 */
export class AppError extends Error {
  /**
   * @param {number} status קוד HTTP
   * @param {string} code מזהה שגיאה יציב ללקוח
   * @param {string} message הודעה בעברית
   * @param {object} [extra] שדות נוספים שיתווספו לגוף השגיאה
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * עוטף Handler אסינכרוני כך שדחיית Promise תגיע ל-middleware השגיאות.
 * (ב-Express 5 זה נתמך מובנה, אך נשמור על עטיפה מפורשת לקריאות.)
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * מטפל בשגיאה שאיננה AppError — למשל שגיאת JSON לא תקין בגוף הבקשה.
 * @returns {AppError}
 */
function normalizeError(err) {
  if (err instanceof AppError) return err;

  // שגיאת פרסור JSON של express.json()
  if (err?.type === 'entity.parse.failed') {
    return new AppError(400, 'invalid_json', 'גוף הבקשה אינו JSON תקין');
  }
  // גוף הבקשה גדול מדי
  if (err?.type === 'entity.too.large') {
    return new AppError(413, 'payload_too_large', 'גוף הבקשה גדול מדי');
  }
  // שגיאת קריאה/כתיבה לקובץ הנתונים
  if (err?.code === 'io_error') {
    return new AppError(500, 'io_error', 'שמירת הנתונים נכשלה, נסו שוב');
  }

  // שגיאה לא צפויה — נרשמת בלוג, ולא נחשפת פרטיה ללקוח.
  console.error('[server] שגיאה לא צפויה:', err);
  return new AppError(500, 'internal_error', 'שגיאת שרת פנימית');
}

/**
 * middleware אחרון בשרשרת. ממיר כל שגיאה לתגובת JSON אחידה.
 */
export function errorHandler(err, req, res, _next) {
  const appError = normalizeError(err);
  if (appError.extra?.retryAfterSeconds) {
    res.set('Retry-After', String(appError.extra.retryAfterSeconds));
  }
  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, ...appError.extra },
  });
}

/**
 * מטפל בבקשות לנתיב לא קיים תחת /api (מוחזר JSON, לא HTML).
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'הנתיב המבוקש לא נמצא' } });
}
