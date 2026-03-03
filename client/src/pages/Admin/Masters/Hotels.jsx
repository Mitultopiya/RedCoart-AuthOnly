import { useState, useEffect } from 'react';
import { getHotels, getCities, createHotel, updateHotel, deleteHotel } from '../../../services/api';
import Loading from '../../../components/Loading';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/DataTable';
import { useToast } from '../../../context/ToastContext';

export default function Hotels() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', city_id: '', address: '', contact: '', room_type: '', price: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getHotels(), getCities()]).then(([h, c]) => {
      setList(h.data || []);
      setCities(c.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ name: '', city_id: '', address: '', contact: '', room_type: '', price: '' });
    setModal({ open: true, data: null });
  };
  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      city_id: row.city_id ?? '',
      address: row.address || '',
      contact: row.contact || '',
      room_type: row.room_type || '',
      price: row.price != null ? String(row.price) : '',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      city_id: form.city_id ? Number(form.city_id) : null,
      price: form.price ? Number(form.price) : null,
    };
    (modal.data ? updateHotel(modal.data.id, payload) : createHotel(payload))
      .then(() => { toast(modal.data ? 'Hotel updated' : 'Hotel added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteHotel(row.id).then(() => { toast('Hotel deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  const getCityName = (id) => cities.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Hotels</h1>
        <Button onClick={openAdd}>+ Add Hotel</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'room_type', label: 'Room Type' },
              { key: 'price', label: 'Price', render: (r) => (r.price != null ? `₹${Number(r.price).toLocaleString()}` : '-') },
              { key: 'address', label: 'Address' },
              { key: 'contact', label: 'Contact' },
              { key: 'city_id', label: 'City', render: (r) => getCityName(r.city_id) },
            ]}
            data={list}
            emptyMessage="No hotels. Add your first hotel."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Hotel' : 'Add Hotel'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <select value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">— Select —</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Room Type" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} />
            <Input
              label="Price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
