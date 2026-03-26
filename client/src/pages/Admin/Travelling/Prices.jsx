import { useEffect, useMemo, useState } from 'react';
import {
  createTravellingPrice,
  deleteTravellingPrice,
  getTravellingLocations,
  getTravellingPrices,
  updateTravellingPrice,
} from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';
import { branchParams, getSelectedBranchId } from '../../../utils/branch';
import { normalizeTransportType, TRANSPORT_OPTIONS } from './constants';

function formatLocationLabel(location) {
  if (!location) return '';
  const name = String(location.location_name || '').trim();
  const state = String(location.state_name || '').trim();
  return state ? `${name} (${state})` : name;
}

function calculateFinalPrice(basePrice, markupPrice) {
  return Number(basePrice || 0) + Number(markupPrice || 0);
}

function emptyDateRow() {
  return { from_date: '', to_date: '', base_price: '' };
}

export default function TravellingPrices() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({
    transport_type: 'Train',
    state_name: '',
    type_name: '',
    from_location_id: '',
    to_location_id: '',
    date_ranges: [emptyDateRow()],
    markup_price: '',
  });

  const load = () => {
    setLoading(true);
    const params = branchParams(branchId);
    Promise.all([getTravellingPrices(params), getTravellingLocations(params)])
      .then(([pricesRes, locationsRes]) => {
        const prices = Array.isArray(pricesRes.data) ? pricesRes.data : [];
        setList(prices.map((row) => ({
          ...row,
          date_ranges: Array.isArray(row.date_ranges) ? row.date_ranges : [],
        })));
        setLocations(Array.isArray(locationsRes.data) ? locationsRes.data : []);
      })
      .catch(() => {
        setList([]);
        setLocations([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const stateOptions = useMemo(
    () => [...new Set(
      locations
        .filter((item) => normalizeTransportType(item.transport_type) === normalizeTransportType(form.transport_type))
        .map((item) => String(item.state_name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)),
    [locations, form.transport_type]
  );
  const typeOptions = useMemo(
    () => [...new Set(
      locations
        .filter((item) => normalizeTransportType(item.transport_type) === normalizeTransportType(form.transport_type))
        .filter((item) => !form.state_name || String(item.state_name || '').trim() === String(form.state_name).trim())
        .map((item) => String(item.type_name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)),
    [locations, form.transport_type, form.state_name]
  );
  const filteredLocations = useMemo(
    () => locations.filter((item) => (
      normalizeTransportType(item.transport_type) === normalizeTransportType(form.transport_type)
      && (!form.state_name || String(item.state_name || '').trim() === String(form.state_name).trim())
      && (!form.type_name || String(item.type_name || '').trim() === String(form.type_name).trim())
    )),
    [locations, form.transport_type, form.state_name, form.type_name]
  );
  const finalPrice = useMemo(
    () => calculateFinalPrice(0, form.markup_price),
    [form.markup_price]
  );

  const openAdd = () => {
    setForm({ transport_type: 'Train', state_name: '', type_name: '', from_location_id: '', to_location_id: '', date_ranges: [emptyDateRow()], markup_price: '' });
    setModal({ open: true, data: null });
  };

  const openEdit = (row) => {
    const ranges = Array.isArray(row.date_ranges) && row.date_ranges.length
      ? row.date_ranges.map((r) => ({
        from_date: r.from_date ? String(r.from_date).slice(0, 10) : '',
        to_date: r.to_date ? String(r.to_date).slice(0, 10) : '',
        base_price: r.base_price != null ? String(r.base_price) : '',
      }))
      : [emptyDateRow()];
    setForm({
      transport_type: normalizeTransportType(row.transport_type),
      state_name: row.from_state_name || row.to_state_name || '',
      type_name: row.from_type_name || row.to_type_name || '',
      from_location_id: row.from_location_id ? String(row.from_location_id) : '',
      to_location_id: row.to_location_id ? String(row.to_location_id) : '',
      date_ranges: ranges,
      markup_price: row.markup_price != null ? String(row.markup_price) : '',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.from_location_id || !form.to_location_id) {
      toast('From and To locations are required.', 'error');
      return;
    }
    const normalizedRanges = (form.date_ranges || [])
      .map((row) => ({
        from_date: String(row.from_date || '').trim(),
        to_date: String(row.to_date || '').trim(),
        base_price: Number(row.base_price || 0),
      }))
      .filter((row) => row.from_date && row.to_date);
    if (!normalizedRanges.length) {
      toast('Add at least one date-wise base price row.', 'error');
      return;
    }
    for (const row of normalizedRanges) {
      if (new Date(row.to_date) < new Date(row.from_date)) {
        toast('To Date must be greater than or equal to From Date.', 'error');
        return;
      }
    }
    setSaving(true);
    const payload = {
      transport_type: form.transport_type,
      from_location_id: Number(form.from_location_id),
      to_location_id: Number(form.to_location_id),
      date_ranges: normalizedRanges,
      base_price: 0,
      markup_price: Number(form.markup_price || 0),
      final_price: finalPrice,
    };
    const req = modal.data
      ? updateTravellingPrice(modal.data.id, payload)
      : createTravellingPrice(payload);
    req
      .then(() => {
        toast(modal.data ? 'Travelling price updated' : 'Travelling price added');
        setModal({ open: false, data: null });
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Save failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm('Delete this travelling price?')) return;
    deleteTravellingPrice(row.id)
      .then(() => {
        toast('Travelling price deleted');
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Travelling Prices</h1>
          <p className="text-sm text-slate-500 mt-1">Create route pricing with date-wise base prices, markup, and total.</p>
        </div>
        <Button onClick={openAdd}>+ Add Price</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <Loading />
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No travelling prices found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([mode, rows]) => (
              <details key={mode} className="group px-4 sm:px-6 py-3" open>
                <summary className="cursor-pointer list-none flex items-center justify-between py-2">
                  <h2 className="text-sm font-semibold text-slate-800">{mode}</h2>
                  <span className="text-xs text-slate-500">{rows.length} route{rows.length > 1 ? 's' : ''}</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Transport Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">From Location</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">To Location</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Date-wise Base Rows</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Markup</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-700">{row.transport_type}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatLocationLabel({ location_name: row.from_location_name, state_name: row.from_state_name }) || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatLocationLabel({ location_name: row.to_location_name, state_name: row.to_state_name }) || '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {(Array.isArray(row.date_ranges) ? row.date_ranges : []).length
                              ? row.date_ranges.map((r) => `${r.from_date} to ${r.to_date}: ₹${Number(r.base_price || 0).toLocaleString('en-IN')}`).join(' | ')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">₹{Number(row.markup_price || 0).toLocaleString()}</td>
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
        title={modal.data ? 'Edit Travelling Price' : 'Add Travelling Price'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transport Type *</label>
            <select
              value={form.transport_type}
              onChange={(e) => setForm((prev) => ({ ...prev, transport_type: e.target.value, state_name: '', type_name: '', from_location_id: '', to_location_id: '' }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {TRANSPORT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
            <select
              value={form.state_name}
              onChange={(e) => setForm((prev) => ({ ...prev, state_name: e.target.value, type_name: '', from_location_id: '', to_location_id: '' }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select state</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
            <select
              value={form.type_name}
              onChange={(e) => setForm((prev) => ({ ...prev, type_name: e.target.value, from_location_id: '', to_location_id: '' }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">{form.state_name ? 'Select type' : 'Select state first'}</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From Location *</label>
              <select
                value={form.from_location_id}
                onChange={(e) => setForm((prev) => ({ ...prev, from_location_id: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">{form.type_name ? 'Select from location' : 'Select type first'}</option>
                {filteredLocations.map((location) => (
                  <option key={location.id} value={location.id}>{formatLocationLabel(location)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To Location *</label>
              <select
                value={form.to_location_id}
                onChange={(e) => setForm((prev) => ({ ...prev, to_location_id: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">{form.type_name ? 'Select to location' : 'Select type first'}</option>
                {filteredLocations.map((location) => (
                  <option key={location.id} value={location.id}>{formatLocationLabel(location)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Date-wise Base Price</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, date_ranges: [...(prev.date_ranges || []), emptyDateRow()] }))}
              >
                + Add Row
              </Button>
            </div>
            {(form.date_ranges || []).map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <Input
                  label="From Date"
                  type="date"
                  value={row.from_date}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    date_ranges: prev.date_ranges.map((r, i) => (i === idx ? { ...r, from_date: e.target.value } : r)),
                  }))}
                />
                <Input
                  label="To Date"
                  type="date"
                  value={row.to_date}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    date_ranges: prev.date_ranges.map((r, i) => (i === idx ? { ...r, to_date: e.target.value } : r)),
                  }))}
                />
                <Input
                  label="Base Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.base_price}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    date_ranges: prev.date_ranges.map((r, i) => (i === idx ? { ...r, base_price: e.target.value } : r)),
                  }))}
                />
                <div className="sm:pb-1">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={(form.date_ranges || []).length === 1}
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      date_ranges: prev.date_ranges.filter((_, i) => i !== idx),
                    }))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Markup Price"
              type="number"
              min="0"
              step="0.01"
              value={form.markup_price}
              onChange={(e) => setForm((prev) => ({ ...prev, markup_price: e.target.value }))}
            />
          </div>
          <p className="text-xs text-slate-500">
            Date-wise base price is used by selected date in Rate Calculator and Invoice.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
