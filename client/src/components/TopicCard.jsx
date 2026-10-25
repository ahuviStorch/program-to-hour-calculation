/**
 * TopicCard — כרטיס נושא בודד.
 *
 * מציג: שם, סה"כ שעות, מצב (רץ / מושהה), שעת ההתחלה של הסשן הפעיל,
 * וכפתורי הפעלה/השהיה ומחיקה.
 *
 * @param {{
 *   topic: { id, name, isRunning, totalSeconds, sessionCount, currentStartTime, sessionSeconds },
 *   busy: boolean,
 *   now: number,
 *   fetchedAt: number,
 *   skewMs: number,
 *   autoCloseSeconds: number,
 *   onStart: (id: string) => void,
 *   onPause: (id: string) => void,
 *   onDelete: (topic: object) => void,
 * }} props
 */
import LiveDuration from './LiveDuration.jsx';
import { formatDurationShort, formatTime } from '../lib/format.js';

export default function TopicCard({
  topic,
  busy,
  now,
  fetchedAt,
  skewMs,
  autoCloseSeconds,
  onStart,
  onPause,
  onDelete,
}) {
  const { id, name, isRunning, totalSeconds, sessionCount, currentStartTime } = topic;
  // משך הסשן הפעיל לפי השרת (0 כשאין סשן פעיל)
  const sessionSeconds = topic.sessionSeconds ?? 0;

  return (
    <article
      className={`flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 transition-shadow hover:shadow-md ${
        isRunning ? 'ring-emerald-300' : 'ring-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-900" title={name}>
            {name}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                פעיל מאז {formatTime(currentStartTime)}
              </span>
            ) : (
              'מושהה'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDelete(topic)}
          disabled={busy}
          className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
          aria-label={`מחיקת הנושא ${name}`}
          title="מחיקת נושא (דורש קוד PIN)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">סה"כ</p>
          <LiveDuration
            baseSeconds={totalSeconds}
            sessionSeconds={sessionSeconds}
            fetchedAt={fetchedAt}
            skewMs={skewMs}
            now={now}
            autoCloseSeconds={autoCloseSeconds}
            running={isRunning}
            className={`text-3xl font-semibold ${isRunning ? 'text-emerald-700' : 'text-slate-800'}`}
          />
          <p className="mt-1 text-xs text-slate-500">
            {formatDurationShort(totalSeconds)} · {sessionCount} רשומות
          </p>
        </div>

        {isRunning ? (
          <button
            type="button"
            onClick={() => onPause(id)}
            aria-label={`השהיית ${name}`}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            {busy ? 'משהים…' : 'השהיה'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStart(id)}
            aria-label={`הפעלת ${name}`}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z" />
            </svg>
            {busy ? 'מפעילים…' : 'הפעלה'}
          </button>
        )}
      </div>
    </article>
  );
}
