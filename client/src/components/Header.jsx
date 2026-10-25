/**
 * Header — כותרת האפליקציה: שם, תיאור קצר ומצב החיבור לשרת.
 */
import { formatDateTime } from '../lib/format.js';

/**
 * @param {{ serverTime: number|null, refreshing: boolean, connected: boolean }} props
 */
export default function Header({ serverTime, refreshing, connected }) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">מעקב שעות עבודה</h1>
        <p className="mt-1 text-sm text-slate-500">
          הפעלה והשהיה של נושאים, וצבירת שעות באופן אוטומטי
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {connected ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span
              className={`h-2 w-2 rounded-full bg-emerald-500 ${
                refreshing ? 'animate-pulse-soft' : ''
              }`}
              aria-hidden="true"
            />
            מחובר
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 font-medium text-red-700 ring-1 ring-red-200">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            אין חיבור לשרת
          </span>
        )}

        {serverTime && (
          <span
            className="font-mono text-slate-500 tabular-nums"
            title="שעת השרת האחרונה שהתקבלה"
          >
            {formatDateTime(new Date(serverTime).toISOString())}
          </span>
        )}
      </div>
    </header>
  );
}
