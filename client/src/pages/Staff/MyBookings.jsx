import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBookings } from '../../services/api';
import { getStoredUser } from '../../utils/auth';
import Loading from '../../components/Loading';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

export default function StaffMyBookings() {
  const user = getStoredUser();
  const [list, setList] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookings({ staff_id: user?.id }).then((r) => setList({ data: r.data?.data || [], total: r.data?.total || 0 })).finally(() => setLoading(false));
  }, [user?.id]);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'package_name', label: 'Package' },
    { key: 'travel_start_date', label: 'Start' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">My Bookings</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <Loading /> : <DataTable columns={columns} data={list.data} />}
      </div>
    </div>
  );
}
