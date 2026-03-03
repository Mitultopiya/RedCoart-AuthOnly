import { useState, useEffect } from 'react';
import { getCities, createCity, updateCity, deleteCity } from '../../../services/api';
import Loading from '../../../components/Loading';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/DataTable';
import { useToast } from '../../../context/ToastContext';

export default function Cities() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', country: 'India' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getCities().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '', country: 'India' }); setModal({ open: true, data: null }); };
  const openEdit = (row) => { setForm({ name: row.name || '', country: row.country || 'India' }); setModal({ open: true, data: row }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    (modal.data ? updateCity(modal.data.id, form) : createCity(form))
      .then(() => { toast(modal.data ? 'City updated' : 'City added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteCity(row.id).then(() => { toast('City deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Cities</h1>
        <Button onClick={openAdd}>+ Add City</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={[{ key: 'name', label: 'Name' }, { key: 'country', label: 'Country' }]}
            data={list}
            emptyMessage="No cities. Add your first city."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit City' : 'Add City'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
