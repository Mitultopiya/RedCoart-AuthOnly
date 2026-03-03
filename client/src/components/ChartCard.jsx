import { Link } from 'react-router-dom';

export default function ChartCard({ title, value, to }) {
  const content = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return content;
}
