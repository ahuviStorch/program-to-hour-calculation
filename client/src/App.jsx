/**
 * App — הרכבת כל המסך.
 *
 * זרימת המחיקה:
 *   1. נושא  → דיאלוג אישור (מציין מספר רשומות ומצב פעיל) → חלון PIN → מחיקה.
 *   2. רשומה → חלון PIN → מחיקה.
 *   ביטול בכל שלב עוצר את התהליך. ה-PIN נשמר רק בזמן החלון.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import Header from './components/Header.jsx';
import Tabs from './components/Tabs.jsx';
import TopicForm from './components/TopicForm.jsx';
import TopicList from './components/TopicList.jsx';
import GlobalHistory from './components/GlobalHistory.jsx';
import TopicHistory from './components/TopicHistory.jsx';
import PinModal from './components/PinModal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Toast from './components/Toast.jsx';

import { useNow } from './hooks/useNow.js';
import { useTracker } from './hooks/useTracker.js';
import { usePinPrompt } from './hooks/usePinPrompt.js';

export default function App() {
  const [tab, setTab] = useState('topics');

  // --- הודעות ---
  const toastIdRef = useRef(0);
  const [toast, setToast] = useState(null);
  const showToast = useCallback(({ type, text }) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, type, text });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  // --- מצב מרכזי ---
  const tracker = useTracker({ onToast: showToast });
  const { topics, busyIds, status, error, syncRef, history, autoCloseSeconds } = tracker;

  // שעון משותף אחד לכל האפליקציה
  const now = useNow(1000);
  const skewMs = syncRef.current.serverTime ? syncRef.current.serverTime - syncRef.current.fetchedAt : 0;
  const fetchedAt = syncRef.current.fetchedAt;

  // --- PIN ואישורים ---
  const { pinDialog, requestPin, submitPin, cancelPin } = usePinPrompt();
  const [pendingTopic, setPendingTopic] = useState(null); // נושא שממתין לאישור
  const [historyTopic, setHistoryTopic] = useState(null); // נושא שהיסטורייתו פתוחה

  // הפעולה שממתינה לקוד: מקבלת את ה-PIN ומבצעת את המחיקה.
  // אם היא זורקת — השגיאה מגיעה ל-PinModal (401/429/אחר) והחלון נשאר פתוח.
  const pendingActionRef = useRef(null);

  const handleSubmitPin = useCallback(
    async (pin) => {
      const action = pendingActionRef.current;
      if (!action) return;
      await action(pin);
      submitPin(pin); // הצלחה — סגירת החלון
    },
    [submitPin]
  );

  /** מחיקת רשומת סשן — מבקש PIN ומבצע. */
  const handleDeleteSession = useCallback(
    async (session) => {
      pendingActionRef.current = (pin) => tracker.removeSession(session.id, pin);
      await requestPin({
        title: 'אישור מחיקת רשומה',
        description: 'הרשומה תימחק לצמיתות ולא ניתן יהיה לשחזר אותה.',
      });
    },
    [requestPin, tracker]
  );

  /** שלב 1 במחיקת נושא: אישור. */
  const handleAskDeleteTopic = useCallback((topic) => {
    setPendingTopic(topic);
    setHistoryTopic(null); // אין לפתוח PIN מעל חלון ההיסטוריה
  }, []);

  /** שלב 2: אישור → PIN → מחיקה. */
  const handleConfirmDeleteTopic = useCallback(async () => {
    const topic = pendingTopic;
    setPendingTopic(null);
    if (!topic) return;

    pendingActionRef.current = async (pin) => {
      await tracker.removeTopic(topic.id, pin);
      if (historyTopic?.id === topic.id) setHistoryTopic(null);
    };

    await requestPin({
      title: 'אישור מחיקת נושא',
      description: `הנושא "${topic.name}" וכל ${topic.sessionCount} הרשומות שלו יימחקו לצמיתות.`,
    });
  }, [historyTopic, pendingTopic, requestPin, tracker]);

  /** הטקסט של הודעת האישור, כולל אזהרה אם המעקב פעיל. */
  const confirmMessage = useMemo(() => {
    if (!pendingTopic) return '';
    return [
      `רשומות שיימחקו: ${pendingTopic.sessionCount}`,
      pendingTopic.isRunning
        ? 'שים לב: המעקב בנושא זה פעיל כעת, והזמן של הסשן הנוכחי לא יישמר.'
        : '',
      'המחיקה אינה ניתנת לביטול.',
    ]
      .filter(Boolean)
      .join('\n');
  }, [pendingTopic]);

  // --- תצוגות טעינה / שגיאה ---
  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="animate-pulse-soft text-center text-slate-500">טוען נתונים…</div>
      </main>
    );
  }

  if (status === 'error' && topics.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div role="alert" className="rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200">
          <p className="text-lg font-semibold text-red-800">לא ניתן לטעון את הנתונים</p>
          <p className="mt-1 text-sm text-red-700">
            {error?.offline
              ? 'אין חיבור לשרת. ודאו שהשרת פועל ונסו שוב.'
              : error?.message || 'אירעה שגיאה לא צפויה.'}
          </p>
          <button
            type="button"
            onClick={tracker.refresh}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            ניסיון חוזר
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Header
        serverTime={syncRef.current.serverTime}
        refreshing={status === 'refreshing'}
        connected={!error?.offline}
      />

      {/* באנר חיבור שנפל באמצע העבודה — הנתונים הקיימים נשארים מוצגים */}
      {error?.offline && (
        <div role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          אין חיבור לשרת. התצוגה עשויה להיות לא מעודכנת, והפעולות ייכשלו עד לחידוש החיבור.
        </div>
      )}

      <Tabs active={tab} onChange={setTab} />

      {tab === 'topics' && (
        <>
          <TopicForm onSubmit={tracker.addTopic} busy={busyIds.has('new-topic')} />

          <TopicList
            topics={topics}
            busyIds={busyIds}
            now={now}
            fetchedAt={fetchedAt}
            skewMs={skewMs}
            autoCloseSeconds={autoCloseSeconds}
            onStart={tracker.start}
            onPause={tracker.pause}
            onDelete={handleAskDeleteTopic}
          />

          {/* גישה מהירה לרשומות של כל נושא */}
          {topics.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-slate-600">היסטוריה לפי נושא</h2>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setHistoryTopic(topic)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors hover:border-indigo-400 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'history' && (
        <GlobalHistory
          loadHistory={tracker.loadHistory}
          history={history}
          busyIds={busyIds}
          now={now}
          fetchedAt={fetchedAt}
          skewMs={skewMs}
          autoCloseSeconds={autoCloseSeconds}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* חלונות */}
      <ConfirmDialog
        open={Boolean(pendingTopic)}
        title={pendingTopic ? `מחיקת הנושא ${pendingTopic.name}` : 'מחיקת נושא'}
        message={confirmMessage}
        confirmLabel="המשך לאישור בקוד PIN"
        onConfirm={handleConfirmDeleteTopic}
        onCancel={() => setPendingTopic(null)}
      />

      <PinModal
        open={pinDialog.open}
        title={pinDialog.title}
        description={pinDialog.description}
        onSubmit={handleSubmitPin}
        onCancel={cancelPin}
      />

      {historyTopic && (
        <TopicHistory
          topic={historyTopic}
          busyIds={busyIds}
          now={now}
          fetchedAt={fetchedAt}
          skewMs={skewMs}
          autoCloseSeconds={autoCloseSeconds}
          onDeleteSession={handleDeleteSession}
          onClose={() => setHistoryTopic(null)}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}
