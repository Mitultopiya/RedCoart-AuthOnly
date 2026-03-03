export default function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          {title && <h3 className="text-base sm:text-lg font-semibold text-slate-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
