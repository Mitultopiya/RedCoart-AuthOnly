import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../services/api';
import Loading from '../../components/Loading';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  const d = data || {};

  const stats = [
    { label: 'Total Customers', value: d.totalCustomers ?? 0, to: '/admin/customers', color: 'bg-primary-500' },
    { label: 'Revenue', value: `₹${(d.monthlyRevenue ?? 0).toLocaleString()}`, color: 'bg-amber-500' },
    { label: 'Pending Payments', value: `₹${(d.pendingPayments ?? 0).toLocaleString()}`, to: '/admin/reports', color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to || '#'} className={s.to ? 'block' : 'pointer-events-none'}>
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${s.color} opacity-90`} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
