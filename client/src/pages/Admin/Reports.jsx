import { useState, useEffect } from 'react';
import { getDashboard, getPendingPayments, getStaffPerformanceReport } from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import DataTable from '../../components/DataTable';

export default function Reports() {
  const [dashboard, setDashboard] = useState(null);
  const [pending, setPending] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboard().then((r) => r.data).catch(() => null),
      getPendingPayments().then((r) => r.data).catch(() => []),
      getStaffPerformanceReport().then((r) => r.data).catch(() => []),
    ]).then(([d, p, s]) => {
      setDashboard(d);
      setPending(Array.isArray(p) ? p : []);
      setStaffPerf(Array.isArray(s) ? s : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Reports</h1>

      <Card title="Summary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
          <div>
            <p className="text-slate-500">Customers</p>
            <p className="text-xl font-semibold text-slate-800">{dashboard?.totalCustomers ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Active Bookings</p>
            <p className="text-xl font-semibold text-slate-800">{dashboard?.activeBookings ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Revenue</p>
            <p className="text-xl font-semibold text-slate-800">₹{(dashboard?.monthlyRevenue ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Pending</p>
            <p className="text-xl font-semibold text-rose-600">₹{(dashboard?.pendingPayments ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card title="Pending Payments">
        <DataTable
          columns={[
            { key: 'customer_name', label: 'Customer' },
            { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount || 0).toLocaleString()}` },
            { key: 'paid', label: 'Paid', render: (r) => `₹${Number(r.paid || 0).toLocaleString()}` },
            { key: 'due', label: 'Due', render: (r) => `₹${Number(r.due || 0).toLocaleString()}` },
          ]}
          data={pending}
          emptyMessage="No pending payments."
        />
      </Card>

      <Card title="Staff Performance">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'completed_count', label: 'Completed Bookings' },
          ]}
          data={staffPerf}
          emptyMessage="No data."
        />
      </Card>
    </div>
  );
}
