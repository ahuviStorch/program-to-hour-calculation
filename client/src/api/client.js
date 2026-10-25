/**
 * api/client.js — שכבת התקשורת עם השרת.
 *
 * כל בקשה עוברת דרך request(), שמטפל ב:
 *   - קידוד JSON והרכבת כתובות יחסיות (/api).
 *   - פירוש מבנה השגיאה האחיד { error: { code, message } }.
 *   - זריקת ApiError לשימון לפנייה בטיפול בכשלים.
 *
 * ה-PIN נשלח בכותרת x-delete-pin ואינו נשמר בשום מקום מתמיד.
 */

/** שגיאת API עם פרטים לשימוש בתצוגה. */
export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** האם מדובר בשגיאת קישוריות (השרת לא זמין) ולא בשגיאת עסקית. */
export const isNetworkError = (err) => err instanceof ApiError && err.code === 'network_error';

/**
 * בקשה כללית לשרת.
 * @param {string} path נתיב יחסי, למשל '/state'
 * @param {{ method?: string, body?: object, pin?: string, signal?: AbortSignal }} options
 */
async function request(path, { method = 'GET', body, pin, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (pin !== undefined) headers['x-delete-pin'] = pin;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'אין חיבור לשרת. בדקו שהשרת פועל.', null);
  }

  // תגובה ללא תוכן (לא אמור לקרות, אך מטפלים ליתר ביטחון)
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, 'bad_response', 'תגובת השרת אינה תקינה', null);
    }
  }

  if (!response.ok) {
    const error = data?.error || {};
    throw new ApiError(
      response.status,
      error.code || 'unknown_error',
      error.message || 'אירעה שגיאה',
      data
    );
  }
  return data;
}

// --- נקודות הקצה ---

/** מצב מלא: כל הנושאים עם סה"כ שעות, וזמן השרת. */
export const getState = (signal) => request('/state', { signal });

/** יצירת נושא חדש. */
export const createTopic = (name) => request('/topics', { method: 'POST', body: { name } });

/** התחלה או המשך מעקב. */
export const startTopic = (id) => request(`/topics/${encodeURIComponent(id)}/start`, { method: 'POST' });

/** השהיית מעקב. */
export const pauseTopic = (id) => request(`/topics/${encodeURIComponent(id)}/pause`, { method: 'POST' });

/** מחיקת נושא (כולל היסטוריה) — מחייב PIN. */
export const deleteTopic = (id, pin) =>
  request(`/topics/${encodeURIComponent(id)}`, { method: 'DELETE', pin });

/** היסטוריית סשנים של נושא מסוים. */
export const getTopicSessions = (id, signal) =>
  request(`/topics/${encodeURIComponent(id)}/sessions`, { signal });

/** היסטוריית סשנים כוללת; from/to בפורמט YYYY-MM-DD. */
export const getHistory = ({ from, to, limit } = {}, signal) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return request(`/history${qs ? `?${qs}` : ''}`, { signal });
};

/** מחיקת רשומת סשן בודדת — מחייב PIN. */
export const deleteSession = (id, pin) =>
  request(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', pin });
