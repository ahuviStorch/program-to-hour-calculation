/**
 * TopicList — רשת כרטיסי הנושאים.
 */
import TopicCard from './TopicCard.jsx';
import EmptyState from './EmptyState.jsx';

/**
 * @param {{
 *   topics: Array<object>,
 *   busyIds: Set<string>,
 *   now: number,
 *   fetchedAt: number,
 *   skewMs: number,
 *   autoCloseSeconds: number,
 *   onStart: Function,
 *   onPause: Function,
 *   onDelete: Function,
 * }} props
 */
export default function TopicList({
  topics,
  busyIds,
  now,
  fetchedAt,
  skewMs,
  autoCloseSeconds,
  onStart,
  onPause,
  onDelete,
}) {
  if (topics.length === 0) {
    return (
      <EmptyState
        title="אין נושאים עדיין"
        description="הוסיפו נושא בטופס שלמעלה כדי להתחיל לעקוב אחרי השעות."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {topics.map((topic) => (
        <TopicCard
          key={topic.id}
          topic={topic}
          busy={busyIds.has(topic.id) || busyIds.has('new-topic')}
          now={now}
          fetchedAt={fetchedAt}
          skewMs={skewMs}
          autoCloseSeconds={autoCloseSeconds}
          onStart={onStart}
          onPause={onPause}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
