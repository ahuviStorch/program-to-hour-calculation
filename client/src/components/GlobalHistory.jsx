/**
 * GlobalHistory — מסך ההיסטוריה הכולל, עם סינון לפי טווח תאריכים.
 *
 * השדות הם תאריכים מקומיים; לפני השליחה ממירים אותם לחותמות ISO
 * של תחילת היום / סוף היום (UTC), כדי שהסינון בשרת יתאים בדיוק
 * למה שהמשתמש רואה בטבלה — בלי תלות באזור הזמן של השרת.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toDateInputValue, toUtcBoundary } from '../lib/format.js';
import HistoryTable from './HistoryTable.jsx';

/**
 * @param {{
 *   loadHistory: Function,
 *   history: { items: Array, loading: boolean, error: string|null },
 *   busyIds: Set<string>,
 *   now: number, fetchedAt: number, skewMs: number, autoCloseSeconds: number,
 *   onDeleteSession: Function,
 * }} props
 */
export default function GlobalHistory({
  loadHistory,
  history,
  busyIds,
  now,
  fetchedAt,
  skewMs,
  autoCloseSeconds,
  onDeleteSession,
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const abortRef = useRef(null);

  const fetchHistory = useCallback(
    (range) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadHistory(
        {
          from: toUtcBoundary(range.from, false),
          to: toUtcBoundary(range.to, true),
        },
        { signal: controller.signal }
      );
    },
    [loadHistory]
  );

  // טעינה ראשונה בעת פתיחת המסך
  useEffect(() => {
    fetchHistory({ from: '', to: '' });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchHistory({ from, to });
  };

  const handleClear = () => {
    setFrom('');
    setTo('');
    fetchHistory({ from: '', to: '' });
  };

  const today = toDateInputValue(new Date());
  const rangeInvalid = Boolean(from && to && from > to);

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate-600">
            מתאריך
          </label>
          <input
            id="from"
            type="date"
            value={from}
            max={to || today}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate-600">
            עד תאריך
          </label>
          <input
            id="to"
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={rangeInvalid || history.loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            סינון
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={history.loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60"
          >
            הצגת הכול
          </button>
        </div>
      </form>

      {rangeInvalid && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          תאריך הסיום מוקדם מתאריך ההתחלה
        </p>
      )}

      <HistoryTable
        items={history.items}
        loading={history.loading}
        error={history.error}
        showTopic
        busyIds={busyIds}
        now={now}
        fetchedAt={fetchedAt}
        skewMs={skewMs}
        autoCloseSeconds={autoCloseSeconds}
        onDelete={onDeleteSession}
      />

      {history.items.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          סה"כ {history.items.length} רשומות
        </p>
      )}
    </section>
  );
}
