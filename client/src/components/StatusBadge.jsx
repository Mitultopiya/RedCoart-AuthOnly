const statusColors = {
  inquiry: 'bg-slate-100 text-slate-800',
  quotation_sent: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  ongoing: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  pending: 'bg-amber-100 text-amber-800',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-slate-200'}`}>
      {status || '-'}
    </span>
  );
}
