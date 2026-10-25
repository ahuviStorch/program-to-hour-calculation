/**
 * PinModal — חלון הזנת קוד PIN לפני מחיקה.
 *
 * מאפייני אבטחה:
 *   - הקוד נשמר רק בסטייט של הרכיב; אינו נכתב ל-localStorage או לכתובת.
 *   - הקוד נשלח לשרת בכותרת x-delete-pin ואינו מועבר ב-URL.
 *   - השרת מחזיר 401 על קוד שגוי (רעידה + הודעת שגיאה) או 429 עם
 *     משך נעילה (ספירה לאחור).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   onSubmit: (pin: string) => Promise<void>,   זורק ApiError בכשל
 *   onCancel: () => void,
 * }} props
 */
export default function PinModal({
  open,
  title,
  description,
  confirmLabel = 'אישור מחיקה',
  onSubmit,
  onCancel,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);

  const inputRef = useRef(null);

  // איפוס מצב בכל פתיחה; מיקוד בשדה
  useEffect(() => {
    if (!open) return;
    setPin('');
    setError('');
    setSubmitting(false);
    setShake(false);
    setLockSeconds(0);
    // המתנה לרינדור כדי למקד
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  // ספירת לאחור של הנעילה
  useEffect(() => {
    if (lockSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setLockSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockSeconds]);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    onCancel();
  }, [onCancel, submitting]);

  // Escape לביטול
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleCancel]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || lockSeconds > 0) return;

    const value = pin.trim();
    if (!value) {
      setError('יש להזין קוד PIN');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(value);
    } catch (err) {
      // החלון נשאר פתוח ומציג את השגיאה, כדי לאפשר ניסיון נוסף
      if (err?.status === 429) {
        const retry = Number(err.data?.error?.retryAfterSeconds) || 60;
        setLockSeconds(retry);
        setError('יותר מדי ניסיונות שגויים. נסו שוב מאוחר יותר.');
      } else if (err?.status === 401) {
        setError('קוד שגוי, נסו שוב');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        setError(err?.message || 'המחיקה נכשלה');
      }
      setPin('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const locked = lockSeconds > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        aria-describedby={description ? 'pin-description' : undefined}
        className={`w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-red-600"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
          </svg>
          <h2 id="pin-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
        </div>

        {description && (
          <p id="pin-description" className="mb-4 text-sm text-slate-600">
            {description}
          </p>
        )}

        <label htmlFor="pin-input" className="mb-1 block text-sm font-medium text-slate-700">
          קוד PIN
        </label>
        <input
          ref={inputRef}
          id="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            if (error) setError('');
          }}
          disabled={submitting || locked}
          maxLength={32}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'pin-error' : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
        />

        {error && (
          <p id="pin-error" role="alert" className="mt-2 text-sm text-red-600">
            {error}
            {locked && (
              <span className="ms-1 font-medium tabular-nums">({lockSeconds} שניות)</span>
            )}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={submitting || locked}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'מאמת…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
