/**
 * EmptyState — תצוגה כשאין נתונים להצגה.
 *
 * @param {{ title: string, description?: string }} props
 */
export default function EmptyState({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
