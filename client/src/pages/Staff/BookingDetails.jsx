import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBooking, addBookingNote } from '../../services/api';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import Alert from '../../components/Alert';

export default function BookingDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    getBooking(id).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    addBookingNote(id, note).then(() => { setNote(''); setAlert({ type: 'success', message: 'Note added.' }); getBooking(id).then((r) => setData(r.data)); }).catch(() => setAlert({ type: 'error', message: 'Failed' }));
  };

  if (loading) return <Loading />;
  if (!data) return <p className="text-slate-500">Booking not found.</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Booking #{data.id}</h2>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <p><span className="text-slate-500">Customer:</span> {data.customer_name}</p>
        <p><span className="text-slate-500">Package:</span> {data.package_name}</p>
        <p><span className="text-slate-500">Dates:</span> {data.travel_start_date} to {data.travel_end_date}</p>
        <p><span className="text-slate-500">Status:</span> <StatusBadge status={data.status} /></p>
        <p><span className="text-slate-500">Total:</span> ₹{Number(data.total_amount || 0).toLocaleString()}</p>
      </div>
      <div className="mt-4">
        <h3 className="font-medium mb-2">Notes</h3>
        <ul className="space-y-1 mb-4">
          {(data.notes || []).map((n) => (
            <li key={n.id} className="text-sm text-slate-600">{n.note} — {n.user_name}</li>
          ))}
        </ul>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note" className="border rounded px-3 py-2 flex-1" />
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded">Add</button>
        </form>
      </div>
    </div>
  );
}
