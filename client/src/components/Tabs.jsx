/**
 * Tabs — ניווט בין "נושאים" ל"היסטוריה".
 * משתמש ב-role="tablist" לתמיכה בנגישות ובמקלדת.
 *
 * @param {{ active: string, onChange: (id: string) => void }} props
 */
const TABS = [
  { id: 'topics', label: 'נושאים' },
  { id: 'history', label: 'היסטוריה' },
];

export default function Tabs({ active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="מסכים"
      className="mb-6 inline-flex rounded-xl bg-slate-200/70 p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
              selected
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
