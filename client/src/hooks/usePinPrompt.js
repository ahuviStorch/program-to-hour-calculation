/**
 * usePinPrompt — ניהול חלון הזנת קוד PIN על בסיס Promise.
 *
 * השימוש:
 *   const pin = await requestPin({ title: '...' });
 *   if (pin) await removeTopic(id, pin);
 *
 * ה-PIN נשמר רק בסטייט של החלון, מועבר לשרת בכותרת הבקשה,
 * ואינו נשמר ב-localStorage, בכתובת או בכל מקום מתמיד אחר.
 */
import { useCallback, useRef, useState } from 'react';

/**
 * @returns {{
 *   pinDialog: { open: boolean, title: string, description: string },
 *   requestPin: (options?: {title?: string, description?: string}) => Promise<string | null>,
 *   submitPin: (pin: string) => void,
 *   cancelPin: () => void,
 * }}
 */
export function usePinPrompt() {
  const [pinDialog, setPinDialog] = useState({
    open: false,
    title: 'אישור מחיקה',
    description: '',
  });

  // הפונקציות שמשלימות את ה-Promise הנוכחי
  const resolverRef = useRef(null);

  const requestPin = useCallback(({ title, description } = {}) => {
    // אם כבר פתוח חלון — מבטלים את הבקשה הקודמת כדי שלא תישאר תלויה
    resolverRef.current?.(null);

    setPinDialog({
      open: true,
      title: title || 'אישור מחיקה',
      description: description || '',
    });

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  /** סוגר את החלון ומחזיר את הקוד שהוזן (או null בביטול). */
  const settle = useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPinDialog((d) => ({ ...d, open: false }));
    resolve?.(value);
  }, []);

  const submitPin = useCallback((pin) => settle(pin), [settle]);
  const cancelPin = useCallback(() => settle(null), [settle]);

  return { pinDialog, requestPin, submitPin, cancelPin };
}
