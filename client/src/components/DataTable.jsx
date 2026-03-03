import Button from './ui/Button';

export default function DataTable({ columns, data, actions, emptyMessage = 'No data' }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[640px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="text-left px-3 sm:px-5 py-2.5 sm:py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {col.label}
              </th>
            ))}
            {actions && <th className="text-right px-3 sm:px-5 py-2.5 sm:py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-slate-50/80 transition">
              {columns.map((col) => (
                <td key={col.key} className="px-3 sm:px-5 py-2.5 sm:py-3.5 text-sm text-slate-800">
                  {col.render ? col.render(row) : (row[col.key] ?? '-')}
                </td>
              ))}
              {actions && (
                <td className="px-3 sm:px-5 py-2.5 sm:py-3.5 text-right whitespace-nowrap">
                  {typeof actions === 'function' ? actions(row) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {(!data || data.length === 0) && (
        <div className="px-4 sm:px-5 py-12 text-center text-slate-500 text-sm">{emptyMessage}</div>
      )}
    </div>
  );
}
