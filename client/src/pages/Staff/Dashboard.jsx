import { useState, useEffect } from 'react';
import { getBookings } from '../../services/api';
import { getStoredUser } from '../../utils/auth';
import Loading from '../../components/Loading';

export default function StaffDashboard() {
  const user = getStoredUser();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookings({ staff_id: user?.id }).then((r) => setBookings(r.data?.data || [])).finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Dashboard</h2>
      <p className="text-slate-600">Assigned bookings: {bookings.length}</p>
    </div>
  );
}
