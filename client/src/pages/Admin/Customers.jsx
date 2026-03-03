import { useState, useEffect } from 'react';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerFamily,
  removeCustomerFamily,
} from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/DataTable';
import { useToast } from '../../context/ToastContext';

const emptyCustomer = { name: '', mobile: '', email: '', address: '', passport: '', family_count: 0, notes: '' };

export default function Customers() {
  const { toast } = useToast();
  const [list, setList] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null });
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [familyForm, setFamilyForm] = useState({ name: '', relation: '', age: '' });

  const load = () => {
    setLoading(true);
    getCustomers({ page, limit: 10, search: search || undefined })
      .then((r) => setList({ data: r.data.data || [], total: r.data.total || 0 }))
      .catch(() => toast('Failed to load customers', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openAdd = () => {
    setForm(emptyCustomer);
    setModal({ open: true, mode: 'add', data: null });
  };

  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      mobile: row.mobile || '',
      email: row.email || '',
      address: row.address || '',
      passport: row.passport || '',
      family_count: row.family_count ?? 0,
      notes: row.notes || '',
    });
    setModal({ open: true, mode: 'edit', data: row });
  };

  const openDetail = (row) => {
    getCustomer(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load customer', 'error'));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, family_count: Number(form.family_count) || 0 };
    (modal.mode === 'add' ? createCustomer(payload) : updateCustomer(modal.data.id, payload))
      .then(() => {
        toast(modal.mode === 'add' ? 'Customer created' : 'Customer updated');
        setModal({ open: false, mode: 'add', data: null });
        load();
        if (detail?.id === modal.data?.id) getCustomer(modal.data.id).then((r) => setDetail(r.data));
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete customer "${row.name}"?`)) return;
    deleteCustomer(row.id)
      .then(() => { toast('Customer deleted'); setDetail(null); load(); })
      .catch(() => toast('Delete failed', 'error'));
  };

  const handleAddFamily = (e) => {
    e.preventDefault();
    if (!detail || !familyForm.name.trim()) return;
    addCustomerFamily(detail.id, familyForm)
      .then(() => {
        toast('Family member added');
        setFamilyForm({ name: '', relation: '', age: '' });
        getCustomer(detail.id).then((r) => setDetail(r.data));
      })
      .catch(() => toast('Failed', 'error'));
  };

  const handleRemoveFamily = (fid) => {
    if (!window.confirm('Remove this family member?')) return;
    removeCustomerFamily(detail.id, fid)
      .then(() => { toast('Removed'); getCustomer(detail.id).then((r) => setDetail(r.data)); })
      .catch(() => toast('Failed', 'error'));
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'family_count', label: 'Family' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Customers</h1>
        <Button onClick={openAdd}>+ Add Customer</Button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name, email, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        {loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={columns}
            data={list.data}
            emptyMessage="No customers yet. Add your first customer."
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => openDetail(row)}>View</Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
        {list.total > 10 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Total {list.total} customers</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page * 10 >= list.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, mode: 'add', data: null })} title={modal.mode === 'add' ? 'Add Customer' : 'Edit Customer'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Passport" value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} />
            <Input label="Family count" type="number" min="0" value={form.family_count} onChange={(e) => setForm({ ...form, family_count: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, mode: 'add', data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : modal.mode === 'add' ? 'Create Customer' : 'Update'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.name} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Email</span><br />{detail.email || '-'}</p>
              <p><span className="text-slate-500">Mobile</span><br />{detail.mobile || '-'}</p>
              <p className="col-span-2"><span className="text-slate-500">Address</span><br />{detail.address || '-'}</p>
              <p><span className="text-slate-500">Passport</span><br />{detail.passport || '-'}</p>
              <p><span className="text-slate-500">Family count</span><br />{detail.family_count ?? 0}</p>
              {detail.notes && <p className="col-span-2"><span className="text-slate-500">Notes</span><br />{detail.notes}</p>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => { setModal({ open: true, mode: 'edit', data: detail }); setDetail(null); }}>Edit Customer</Button>
            </div>
            <hr />
            <h4 className="font-medium text-slate-800">Family Members</h4>
            <form onSubmit={handleAddFamily} className="flex flex-wrap gap-2 items-end">
              <Input placeholder="Name" value={familyForm.name} onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })} className="flex-1 min-w-[120px]" />
              <Input placeholder="Relation" value={familyForm.relation} onChange={(e) => setFamilyForm({ ...familyForm, relation: e.target.value })} className="w-28" />
              <Input placeholder="Age" type="number" value={familyForm.age} onChange={(e) => setFamilyForm({ ...familyForm, age: e.target.value })} className="w-20" />
              <Button type="submit" size="sm">Add</Button>
            </form>
            <ul className="space-y-2">
              {(detail.family || []).map((f) => (
                <li key={f.id} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                  <span>{f.name} {f.relation && `(${f.relation})`} {f.age && `- ${f.age} yrs`}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveFamily(f.id)}>Remove</Button>
                </li>
              ))}
              {(!detail.family || detail.family.length === 0) && <li className="text-slate-500 text-sm">No family members added.</li>}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}
