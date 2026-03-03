import { useState, useEffect } from 'react';
import { getStaff, createStaff, updateStaff, toggleBlockStaff, deleteStaff } from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/DataTable';
import { useToast } from '../../context/ToastContext';

export default function Staff() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', branch: 'Ahmedabad' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getStaff().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', role: 'staff', branch: 'Ahmedabad' });
    setModal({ open: true, data: null });
  };
  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      email: row.email || '',
      password: '',
      role: row.role || 'staff',
      branch: row.branch || 'Ahmedabad',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast('Name and email required', 'error'); return; }
    setSaving(true);
    if (modal.data) {
      updateStaff(modal.data.id, { name: form.name, email: form.email, role: form.role, branch: form.branch })
        .then(() => { toast('Staff updated'); setModal({ open: false, data: null }); load(); })
        .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
        .finally(() => setSaving(false));
    } else {
      if (!form.password) { toast('Password required for new staff', 'error'); setSaving(false); return; }
      createStaff(form)
        .then(() => { toast('Staff added'); setModal({ open: false, data: null }); load(); })
        .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
        .finally(() => setSaving(false));
    }
  };

  const handleBlock = (row) => {
    toggleBlockStaff(row.id, !row.is_blocked)
      .then(() => { toast(row.is_blocked ? 'Unblocked' : 'Blocked'); load(); })
      .catch(() => toast('Failed', 'error'));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete staff "${row.name}"? This cannot be undone.`)) return;
    deleteStaff(row.id)
      .then(() => { toast('Staff deleted'); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'));
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'branch', label: 'Branch' },
    { key: 'role', label: 'Role', render: (r) => <span className="capitalize">{r.role}</span> },
    { key: 'is_blocked', label: 'Status', render: (r) => r.is_blocked ? <span className="text-red-600 font-medium">Blocked</span> : <span className="text-emerald-600">Active</span> },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Staff</h1>
        <Button onClick={openAdd}>+ Add Staff</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={columns}
            data={list}
            emptyMessage="No staff. Add manager or staff members."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant={row.is_blocked ? 'primary' : 'danger'} onClick={() => handleBlock(row)}>{row.is_blocked ? 'Unblock' : 'Block'}</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Staff' : 'Add Staff'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!modal.data} />
          {!modal.data && <Input label="Password *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="Ahmedabad">Ahmedabad</option>
              <option value="Junagadh">Junagadh</option>
              <option value="Baroda">Baroda</option>
              <option value="Rajkot">Rajkot</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
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
