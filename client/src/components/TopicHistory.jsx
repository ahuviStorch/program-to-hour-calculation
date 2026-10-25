/**
 * TopicHistory — היסטוריית הרשומות של נושא בודד, בתוך חלון.
 *
 * נטענת בלחיצה (ולא מראש) כדי לא להעמיס בקשות על כל כרטיס.
 * מחיקת רשומה דורשת PIN ומתבצעת דרך App.
 */
import { useEffect, useRef, useState } from 'react';
import { getTopicSessions } from '../api/client.js';
import HistoryTable from './HistoryTable.jsx';

/**
 * @param {{
 *   topic: { id: string, name: string },
 *   busyIds: Set<string>,
 *   now: number, fetchedAt: number, skewMs: number, autoCloseSeconds: number,
 *   onDeleteSession: (session: object) => void,
 *   onClose: () => void,
 * }} props
 */
export default function TopicHistory({
  topic,
  busyIds,
  now,
  fetchedAt,
  skewMs,
  autoCloseSeconds,
  onDeleteSession,
  onClose,
}) {
  const [history, setHistory] = useState({ items: [], loading: true, error: null });
  const closeRef = useRef(null);

  // טעינה בכל פתיחה; ביטול הבקשה ביציאה
  useEffect(() => {
    const controller = new AbortController();
    setHistory({ items: [], loading: true, error: null });

    getTopicSessions(topic.id, controller.signal)
      .then((data) => setHistory({ items: data.items, loading: false, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setHistory({ items: [], loading: false, error: err.message || 'טעינת ההיסטוריה נכשלה' });
      });

    return () => controller.abort();
  }, [topic.id]);

  // Escape לסגירה
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-history-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="topic-history-title" className="truncate text-lg font-semibold text-slate-900">
              היסטוריה — {topic.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {history.items.length > 0 ? `${history.items.length} רשומות` : 'רשומות המעקב של הנושא'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            סגירה
          </button>
        </div>

        <div className="overflow-y-auto">
          <HistoryTable
            items={history.items}
            loading={history.loading}
            error={history.error}
            showTopic={false}
            busyIds={busyIds}
            now={now}
            fetchedAt={fetchedAt}
            skewMs={skewMs}
            autoCloseSeconds={autoCloseSeconds}
            onDelete={onDeleteSession}
          />
        </div>
      </div>
    </div>
  );
}
