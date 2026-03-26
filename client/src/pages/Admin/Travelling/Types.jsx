import { useEffect, useMemo, useState } from 'react';
import {
  createTravellingType,
  deleteTravellingType,
  getTravellingTypes,
  updateTravellingType,
} from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';
import { branchParams, getSelectedBranchId } from '../../../utils/branch';
import { getSuggestedTypes, normalizeTransportType, TRANSPORT_OPTIONS } from './constants';

const CUSTOM_OPTION = '__custom__';

export default function TravellingTypes() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({
    transport_type: 'Train',
    option_value: '',
    custom_name: '',
  });

  const load = () => {
    setLoading(true);
    getTravellingTypes(branchParams(branchId))
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const suggestedOptions = useMemo(
    () => getSuggestedTypes(form.transport_type),
    [form.transport_type]
  );

  const openAdd = () => {
    setForm({ transport_type: 'Train', option_value: '', custom_name: '' });
    setModal({ open: true, data: null });
  };

  const openEdit = (row) => {
    const transportType = normalizeTransportType(row.transport_type);
    const suggestions = getSuggestedTypes(transportType);
    const name = String(row.name || '');
    const isSuggested = suggestions.includes(name);
    setForm({
      transport_type: transportType,
      option_value: isSuggested ? name : CUSTOM_OPTION,
      custom_name: isSuggested ? '' : name,
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = form.option_value === CUSTOM_OPTION ? form.custom_name.trim() : form.option_value.trim();
    if (!finalName) {
      toast('Type name is required.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      transport_type: form.transport_type,
      name: finalName,
    };
    const req = modal.data
      ? updateTravellingType(modal.data.id, payload)
      : createTravellingType(payload);
    req
      .then(() => {
        toast(modal.data ? 'Travelling type updated' : 'Travelling type added');
        setModal({ open: false, data: null });
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Save failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete type "${row.name}"?`)) return;
    deleteTravellingType(row.id)
      .then(() => {
        toast('Travelling type deleted');
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Delete failed', 'error'));
  };

  const grouped = useMemo(() => (
    list.reduce((acc, row) => {
      const key = normalizeTransportType(row.transport_type);
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {})
  ), [list]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Travelling Types</h1>
          <p className="text-sm text-slate-500 mt-1">Manage train and flight type options used in travelling masters.</p>
        </div>
        <Button onClick={openAdd}>+ Add Type</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <Loading />
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No travelling types found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([mode, rows]) => (
              <details key={mode} className="group px-4 sm:px-6 py-3" open>
                <summary className="cursor-pointer list-none flex items-center justify-between py-2">
                  <h2 className="text-sm font-semibold text-slate-800">{mode}</h2>
                  <span className="text-xs text-slate-500">{rows.length} type{rows.length > 1 ? 's' : ''}</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Transport Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Type Name</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-700">{row.transport_type}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => openEdit(row)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Edit</button>
                              <button onClick={() => handleDelete(row)} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        title={modal.data ? 'Edit Travelling Type' : 'Add Travelling Type'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transport Type *</label>
            <select
              value={form.transport_type}
              onChange={(e) => setForm({ transport_type: e.target.value, option_value: '', custom_name: '' })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {TRANSPORT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
            <select
              value={form.option_value}
              onChange={(e) => setForm((prev) => ({ ...prev, option_value: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select type</option>
              {suggestedOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value={CUSTOM_OPTION}>Other (custom)</option>
            </select>
          </div>

          {form.option_value === CUSTOM_OPTION && (
            <Input
              label="Custom Type Name *"
              value={form.custom_name}
              onChange={(e) => setForm((prev) => ({ ...prev, custom_name: e.target.value }))}
              placeholder="Enter custom type name"
              required
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
