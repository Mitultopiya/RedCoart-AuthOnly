import { useEffect, useMemo, useState } from 'react';
import {
  createTravellingLocation,
  deleteTravellingLocation,
  getCities,
  getTravellingLocations,
  getTravellingTypes,
  updateTravellingLocation,
} from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';
import { branchParams, getSelectedBranchId } from '../../../utils/branch';
import { getUniqueStates } from '../../../utils/cities';
import { getLocationLabel, normalizeTransportType, TRANSPORT_OPTIONS } from './constants';

export default function TravellingLocations() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({
    transport_type: 'Train',
    travelling_type_id: '',
    state_name: '',
    location_name: '',
  });

  const load = () => {
    setLoading(true);
    const params = branchParams(branchId);
    Promise.all([getTravellingLocations(params), getTravellingTypes(params), getCities(params)])
      .then(([locationsRes, typesRes, citiesRes]) => {
        setList(Array.isArray(locationsRes.data) ? locationsRes.data : []);
        setTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
        setCities(Array.isArray(citiesRes.data) ? citiesRes.data : []);
      })
      .catch(() => {
        setList([]);
        setTypes([]);
        setCities([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const stateOptions = useMemo(() => getUniqueStates(cities), [cities]);
  const filteredTypes = useMemo(
    () => types.filter((item) => normalizeTransportType(item.transport_type) === normalizeTransportType(form.transport_type)),
    [types, form.transport_type]
  );
  const locationLabel = getLocationLabel(form.transport_type);

  const openAdd = () => {
    setForm({ transport_type: 'Train', travelling_type_id: '', state_name: '', location_name: '' });
    setModal({ open: true, data: null });
  };

  const openEdit = (row) => {
    setForm({
      transport_type: normalizeTransportType(row.transport_type),
      travelling_type_id: row.travelling_type_id ? String(row.travelling_type_id) : '',
      state_name: row.state_name || '',
      location_name: row.location_name || '',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.travelling_type_id || !form.state_name.trim() || !form.location_name.trim()) {
      toast('Type, state, and location are required.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      transport_type: form.transport_type,
      travelling_type_id: Number(form.travelling_type_id),
      state_name: form.state_name.trim(),
      location_name: form.location_name.trim(),
    };
    const req = modal.data
      ? updateTravellingLocation(modal.data.id, payload)
      : createTravellingLocation(payload);
    req
      .then(() => {
        toast(modal.data ? 'Travelling location updated' : 'Travelling location added');
        setModal({ open: false, data: null });
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Save failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete location "${row.location_name}"?`)) return;
    deleteTravellingLocation(row.id)
      .then(() => {
        toast('Travelling location deleted');
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Delete failed', 'error'));
  };

  const grouped = useMemo(() => (
    list.reduce((acc, row) => {
      const mode = normalizeTransportType(row.transport_type);
      if (!acc[mode]) acc[mode] = {};
      const stateName = row.state_name || 'Other';
      if (!acc[mode][stateName]) acc[mode][stateName] = [];
      acc[mode][stateName].push(row);
      return acc;
    }, {})
  ), [list]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Travelling Locations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage train platforms and flight airports by transport type and state.</p>
        </div>
        <Button onClick={openAdd}>+ Add Location</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <Loading />
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No travelling locations found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([mode, stateGroups]) => (
              <details key={mode} className="group px-4 sm:px-6 py-3" open>
                <summary className="cursor-pointer list-none flex items-center justify-between py-2">
                  <h2 className="text-sm font-semibold text-slate-800">{mode}</h2>
                  <span className="text-xs text-slate-500">{Object.values(stateGroups).flat().length} locations</span>
                </summary>
                <div className="mt-2 space-y-2">
                  {Object.entries(stateGroups).map(([stateName, rows]) => (
                    <details key={`${mode}-${stateName}`} className="ml-2 border border-slate-200 rounded-lg" open>
                      <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{stateName}</span>
                        <span className="text-xs text-slate-500">{rows.length}</span>
                      </summary>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px]">
                          <thead>
                            <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                              <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Transport Type</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Type</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold uppercase">{mode === 'Train' ? 'Platform Name' : 'Airport Name'}</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((row) => (
                              <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-700">{row.transport_type}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.type_name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{row.location_name}</td>
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
              </details>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        title={modal.data ? 'Edit Travelling Location' : 'Add Travelling Location'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transport Type *</label>
            <select
              value={form.transport_type}
              onChange={(e) => setForm({ transport_type: e.target.value, travelling_type_id: '', state_name: form.state_name, location_name: form.location_name })}
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
              value={form.travelling_type_id}
              onChange={(e) => setForm((prev) => ({ ...prev, travelling_type_id: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select type</option>
              {filteredTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
            <select
              value={form.state_name}
              onChange={(e) => setForm((prev) => ({ ...prev, state_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select state</option>
              {stateOptions.map((stateName) => (
                <option key={stateName} value={stateName}>{stateName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{locationLabel} *</label>
            <input
              value={form.location_name}
              onChange={(e) => setForm((prev) => ({ ...prev, location_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={`Enter ${locationLabel.toLowerCase()}`}
              required
            />
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
