/**
 * useNow — שעון "מתקתק" אחד לכל האפליקציה.
 *
 * במקום שכל רכיב יפתח טיימר משלו, האפליקציה מחזיקה טיימר יחיד,
 * ומעבירה את הזמן הנוכחי לרכיבים שמציגים ספירה חיה.
 * הטיימר עוצר כשהלשונית מוסתרת (חיסכון במשאבים) ומתחדש בחזרה.
 */
import { useEffect, useState } from 'react';

/**
 * @param {number} intervalMs מרווח העדכון במילישניות
 * @returns {number} חותמת הזמן העדכנית (Date.now)
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer = null;

    const tick = () => setNow(Date.now());

    const start = () => {
      if (timer !== null) return;
      tick(); // סנכרון מיידי בחזרה ללשונית
      timer = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
