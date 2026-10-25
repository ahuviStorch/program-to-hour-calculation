/**
 * TopicForm — טופס ליצירת נושא חדש.
 * אורך השם מוגבל ל-60 תווים (אותו גבול נאכף בשרת).
 */
import { useState } from 'react';

const MAX_LENGTH = 60;

/**
 * @param {{ onSubmit: (name: string) => Promise<unknown>, busy: boolean }} props
 */
export default function TopicForm({ onSubmit, busy }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError('יש להזין שם לנושא');
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`שם הנושא יכול להכיל עד ${MAX_LENGTH} תווים`);
      return;
    }

    setError('');
    try {
      await onSubmit(trimmed);
      setName('');
    } catch (err) {
      // השרת מחזיר הודעה מדויקת; מציגים אותה במקום הודעת הטופס הכללית
      setError(err?.message || 'יצירת הנושא נכשלה');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <label htmlFor="topic-name" className="mb-2 block text-sm font-medium text-slate-700">
        נושא חדש
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="topic-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          maxLength={MAX_LENGTH}
          placeholder="שם הנושא"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'topic-name-error' : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'יוצר…' : 'הוספה'}
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {error ? (
          <p id="topic-name-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : (
          <span />
        )}
        <span className="text-xs text-slate-400 tabular-nums">
          {name.length}/{MAX_LENGTH}
        </span>
      </div>
    </form>
  );
}
