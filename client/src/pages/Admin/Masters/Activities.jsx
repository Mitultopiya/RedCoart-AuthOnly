import { useState, useEffect } from 'react';
import { getActivities, getCities, createActivity, updateActivity, deleteActivity } from '../../../services/api';
import Loading from '../../../components/Loading';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/DataTable';
import { useToast } from '../../../context/ToastContext';

export default function Activities() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', description: '', city_id: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getActivities(), getCities()]).then(([a, c]) => {
      setList(a.data || []);
      setCities(c.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '', description: '', city_id: '' }); setModal({ open: true, data: null }); };
  const openEdit = (row) => { setForm({ name: row.name || '', description: row.description || '', city_id: row.city_id ?? '' }); setModal({ open: true, data: row }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, city_id: form.city_id ? Number(form.city_id) : null };
    (modal.data ? updateActivity(modal.data.id, payload) : createActivity(payload))
      .then(() => { toast(modal.data ? 'Activity updated' : 'Activity added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteActivity(row.id).then(() => { toast('Activity deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  const getCityName = (id) => cities.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Activities</h1>
        <Button onClick={openAdd}>+ Add Activity</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'description', label: 'Description' },
              { key: 'city_id', label: 'City', render: (r) => getCityName(r.city_id) },
            ]}
            data={list}
            emptyMessage="No activities. Add your first activity."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Activity' : 'Add Activity'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <select value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">— Select —</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
