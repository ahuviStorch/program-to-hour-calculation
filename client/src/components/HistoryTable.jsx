/**
 * HistoryTable — טבלת רשומות מעקב (סשנים).
 *
 * עמודות: תאריך, התחלה, סיום, משך, נושא (בהיסטוריה כוללת), פעולה.
 * רשומה פעילה מציגה ספירה חיה, וכפתור המחיקה שלה מושבת
 * (השרת מחזיר 409 אם מנסים למחוק אותה בכל זאת).
 */
import { formatDate, formatDuration, formatTime, isSameLocalDay } from '../lib/format.js';
import EmptyState from './EmptyState.jsx';
import LiveDuration from './LiveDuration.jsx';

/**
 * @param {{
 *   items: Array<object>,
 *   loading: boolean,
 *   error: string|null,
 *   showTopic: boolean,
 *   busyIds: Set<string>,
 *   now: number,
 *   fetchedAt: number,
 *   skewMs: number,
 *   autoCloseSeconds: number,
 *   onDelete: (session: object) => void,
 * }} props
 */
export default function HistoryTable({
  items,
  loading,
  error,
  showTopic,
  busyIds,
  now,
  fetchedAt,
  skewMs,
  autoCloseSeconds,
  onDelete,
}) {
  if (error) {
    return (
      <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
        {error}
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        טוען רשומות…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="אין רשומות להצגה"
        description="רשומות יופיעו כאן לאחר הפעלה והשהיה של נושא."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">תאריך</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">התחלה</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">סיום</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">משך</th>
            {showTopic && (
              <th scope="col" className="px-4 py-3 text-start font-medium">נושא</th>
            )}
            <th scope="col" className="px-4 py-3 text-start font-medium">
              <span className="sr-only">פעולה</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const running = Boolean(item.isRunning);
            const sameDay = running || isSameLocalDay(item.startTime, item.endTime);
            const busy = busyIds.has(item.id);

            return (
              <tr key={item.id} className={running ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatDate(item.startTime)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700 tabular-nums">
                  {formatTime(item.startTime)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">
                  {running ? (
                    <span className="font-sans font-medium text-emerald-700">פעיל</span>
                  ) : sameDay ? (
                    <span className="text-slate-700">{formatTime(item.endTime)}</span>
                  ) : (
                    // רשומה שחוצה חצות — מוצג התאריך המלא כדי למנוע בלבול
                    <span className="text-slate-700">
                      {formatDate(item.endTime)} {formatTime(item.endTime)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">
                  {running ? (
                    <LiveDuration
                      baseSeconds={item.durationSeconds}
                      sessionSeconds={item.durationSeconds}
                      fetchedAt={fetchedAt}
                      skewMs={skewMs}
                      now={now}
                      autoCloseSeconds={autoCloseSeconds}
                      running
                      className="text-emerald-700"
                    />
                  ) : (
                    <span className={item.closedBy === 'auto' ? 'text-amber-700' : 'text-slate-700'}>
                      {formatDuration(item.durationSeconds)}
                      {item.closedBy === 'auto' && (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-sans">
                          נסגר אוטומטית
                        </span>
                      )}
                    </span>
                  )}
                </td>
                {showTopic && (
                  <td className="max-w-[14rem] truncate px-4 py-3 text-slate-700" title={item.topicName}>
                    {item.topicName}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-end">
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={running || busy}
                    title={running ? 'לא ניתן למחוק רשומה פעילה' : 'מחיקה (דורש קוד PIN)'}
                    aria-label={running ? 'לא ניתן למחוק רשומה פעילה' : 'מחיקת הרשומה'}
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
