/**
 * Toast — הודעות קצרות שנעלמות מעצמן (הצלחה / שגיאה).
 *
 * מציג הודעה אחת בכל רגע; הודעה חדשה מחליפה את הקודמת.
 * מוגדר כ-aria-live כדי שקוראי מסך יכריזו על ההודעה.
 */
import { useEffect } from 'react';

const DURATION_MS = 4000;

const STYLES = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
};

/**
 * @param {{ toast: { id: number, type: string, text: string } | null, onClose: () => void }} props
 */
export default function Toast({ toast, onClose }) {
  // סגירה אוטומטית לאחר מספר שניות
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      {toast && (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            STYLES[toast.type] || STYLES.info
          }`}
        >
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-0.5 opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="סגירת ההודעה"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
