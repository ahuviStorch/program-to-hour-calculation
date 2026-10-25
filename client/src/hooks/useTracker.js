/**
 * useTracker — מקור המצב היחיד של האפליקציה.
 *
 * אחריות:
 *   - טעינת /api/state (נושאים + סה"כ שעות) וטעינת היסטוריה לפי הצורך.
 *   - רענון תקופתי כשהלשונית גלויה, ובחזרה ללשונית/לחלון.
 *   - תיקון הפרש שעונים בין הלקוח לשרת (skew), כדי שהספירה החיה תהיה מדויקת.
 *   - ביצוע פעולות (יצירה, התחלה, השהיה, מחיקה) ורענון לאחריהן.
 *
 * השרת הוא מקור האמת: הסה"כ מגיע ממנו, והלקוח רק מוסיף את הזמן שחלף מאז הטעינה.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/client.js';
import { ApiError, isNetworkError } from '../api/client.js';

const POLL_MS = 30_000;

/**
 * @param {{ onToast?: (toast: {type: string, text: string}) => void }} options
 */
export function useTracker({ onToast } = {}) {
  const [status, setStatus] = useState('loading'); // loading | ready | refreshing | error
  const [error, setError] = useState(null);
  const [state, setState] = useState(null); // { topics, autoCloseSeconds, ... }
  const [history, setHistory] = useState({ items: [], loading: false, error: null });
  const [busyIds, setBusyIds] = useState(() => new Set());

  // ערכי ייחוס לספירה חיה — לא בסטייט כדי לא לגרום לרנדורים מיותרים
  const syncRef = useRef({ serverTime: null, fetchedAt: 0 });

  // הפניה העדכנית ל-onToast, כדי לא ליצור תלות מחדש בטעינה
  const toastRef = useRef(onToast);
  useEffect(() => {
    toastRef.current = onToast;
  }, [onToast]);

  const toast = useCallback((type, text) => toastRef.current?.({ type, text }), []);

  /** טוען את המצב מהשרת. keepData=true שומר על המידע הקיים בזמן רענון. */
  const loadState = useCallback(async ({ keepData = false, signal } = {}) => {
    setStatus(keepData ? 'refreshing' : 'loading');
    try {
      const data = await api.getState(signal);
      // חישוב הפרש השעונים: (שעת השרת) − (שעת הלקוח) ברגע התגובה.
      syncRef.current = { serverTime: data.serverTime, fetchedAt: Date.now() };
      setState(data);
      setError(null);
      setStatus('ready');
      return data;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      setError({
        code: err instanceof ApiError ? err.code : 'unknown_error',
        message: err.message || 'טעינת הנתונים נכשלה',
        offline: isNetworkError(err),
      });
      setStatus(state ? 'ready' : 'error');
      return null;
    }
  }, [state]);

  // טעינה ראשונית
  useEffect(() => {
    const controller = new AbortController();
    loadState({ signal: controller.signal });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * רענון תקופתי + רענון בחזרה ללשונית.
   * הרענון שומר את המידע הקיים, כך שאין הבהוב של "טוען".
   */
  useEffect(() => {
    let timer = null;

    const refresh = () => loadState({ keepData: true });

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => refresh();

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** סימון מזהה כ"בפעולה" — כדי לנטרל כפתורים ולמנוע לחיצה כפולה. */
  const withBusy = useCallback(async (id, fn) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      return await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  /**
   * מטפל אחיד בשגיאות פעולה: מציג הודעה, ומרענן את המצב
   * בשגיאות 409/404 (מצב הלקוח התיישן).
   */
  const handleActionError = useCallback(
    async (err, fallback = 'הפעולה נכשלה') => {
      if (err?.name === 'AbortError') return;
      toast('error', err?.message || fallback);
      if (err instanceof ApiError && [404, 409].includes(err.status)) {
        await loadState({ keepData: true });
      }
    },
    [loadState, toast]
  );

  // --- פעולות ---

  const addTopic = useCallback(
    async (name) => {
      try {
        const topic = await withBusy('new-topic', () => api.createTopic(name));
        await loadState({ keepData: true });
        toast('success', 'הנושא נוצר בהצלחה');
        return topic;
      } catch (err) {
        await handleActionError(err, 'יצירת הנושא נכשלה');
        throw err;
      }
    },
    [handleActionError, loadState, toast, withBusy]
  );

  const start = useCallback(
    async (topicId) => {
      try {
        await withBusy(topicId, () => api.startTopic(topicId));
        await loadState({ keepData: true });
      } catch (err) {
        await handleActionError(err, 'הפעלת המעקב נכשלה');
      }
    },
    [handleActionError, loadState, withBusy]
  );

  const pause = useCallback(
    async (topicId) => {
      try {
        await withBusy(topicId, () => api.pauseTopic(topicId));
        await loadState({ keepData: true });
        toast('success', 'המעקב הושהה ונשמר');
      } catch (err) {
        await handleActionError(err, 'השהיית המעקב נכשלה');
      }
    },
    [handleActionError, loadState, toast, withBusy]
  );

  /** מחיקת נושא. ה-PIN כבר אומת על ידי חלון ה-PIN; השרת בודק אותו שוב. */
  const removeTopic = useCallback(
    async (topicId, pin) => {
      try {
        await withBusy(topicId, () => api.deleteTopic(topicId, pin));
        await loadState({ keepData: true });
        toast('success', 'הנושא וההיסטוריה שלו נמחקו');
        return true;
      } catch (err) {
        await handleActionError(err, 'מחיקת הנושא נכשלה');
        throw err;
      }
    },
    [handleActionError, loadState, toast, withBusy]
  );

  /** מחיקת סשן בודד. מחזיר true בהצלחה. */
  const removeSession = useCallback(
    async (sessionId, pin) => {
      try {
        await withBusy(sessionId, () => api.deleteSession(sessionId, pin));
        await loadState({ keepData: true });
        toast('success', 'הרשומה נמחקה');
        return true;
      } catch (err) {
        await handleActionError(err, 'מחיקת הרשומה נכשלה');
        throw err;
      }
    },
    [handleActionError, loadState, toast, withBusy]
  );

  /** טוען את ההיסטוריה (של נושא מסוים או כולה) לפי הסינון הנוכחי. */
  const loadHistory = useCallback(
    async ({ topicId = null, from = '', to = '' } = {}, { signal } = {}) => {
      setHistory((h) => ({ ...h, loading: true, error: null }));
      try {
        const data = topicId
          ? await api.getTopicSessions(topicId, signal)
          : await api.getHistory({ from, to, limit: 500 }, signal);
        // חידוש ייחוס השעה גם מהיסטוריה — כדי שהספירה של רשומה פעילה תהיה מדויקת
        syncRef.current = { serverTime: data.serverTime, fetchedAt: Date.now() };
        setHistory({ items: data.items, loading: false, error: null });
      } catch (err) {
        if (err.name === 'AbortError') return;
        setHistory((h) => ({
          ...h,
          loading: false,
          error: err.message || 'טעינת ההיסטוריה נכשלה',
        }));
      }
    },
    []
  );

  return {
    status,
    error,
    topics: state?.topics ?? [],
    autoCloseSeconds: state?.autoCloseSeconds ?? 6 * 3600,
    syncRef,
    history,
    busyIds,
    refresh: () => loadState({ keepData: true }),
    addTopic,
    start,
    pause,
    removeTopic,
    removeSession,
    loadHistory,
  };
}
