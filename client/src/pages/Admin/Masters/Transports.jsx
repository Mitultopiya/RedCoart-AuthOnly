import { useEffect, useMemo, useState } from 'react';
import { createTransport, deleteTransport, getCities, getTransports, updateTransport } from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';
import { branchParams, getSelectedBranchId } from '../../../utils/branch';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TRANSPORT_TYPES = ['Flight', 'Train'];

const emptyMonthPrices = () => MONTHS.reduce((acc, m) => ({ ...acc, [m]: '' }), {});

export default function Transports() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({
    transport_type: 'Flight',
    from_location: '',
    to_location: '',
    base_price: '',
    markup_price: '',
    price: '',
    month_prices: emptyMonthPrices(),
  });

  const load = () => {
    setLoading(true);
    Promise.all([getTransports(branchParams(branchId)), getCities(branchParams(branchId))])
      .then(([t, c]) => {
        setList(Array.isArray(t.data) ? t.data : []);
        setCities(Array.isArray(c.data) ? c.data : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const computeFinalPrice = (basePrice, markupPrice) => {
    const base = Number(basePrice || 0);
    const markup = Number(markupPrice || 0);
    return base + markup;
  };

  const syncAllMonthsWithFinal = (finalPrice) => {
    const value = finalPrice ? String(finalPrice) : '';
    return MONTHS.reduce((acc, m) => ({ ...acc, [m]: value }), {});
  };

  const openAdd = () => {
    setForm({
      transport_type: 'Flight',
      from_location: '',
      to_location: '',
      base_price: '',
      markup_price: '',
      price: '',
      month_prices: emptyMonthPrices(),
    });
    setModal({ open: true, data: null });
  };

  const openEdit = (row) => {
    const monthPrices = emptyMonthPrices();
    if (row.month_prices && typeof row.month_prices === 'object') {
      MONTHS.forEach((m) => {
        if (row.month_prices[m] != null) monthPrices[m] = String(row.month_prices[m]);
      });
    }
    setForm({
      transport_type: row.transport_type || 'Flight',
      from_location: row.from_location || '',
      to_location: row.to_location || '',
      base_price: row.base_price != null ? String(row.base_price) : '',
      markup_price: row.markup_price != null ? String(row.markup_price) : '',
      price: row.price != null ? String(row.price) : '',
      month_prices: monthPrices,
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const finalPrice = computeFinalPrice(form.base_price, form.markup_price);
    const payload = {
      transport_type: form.transport_type,
      from_location: form.from_location.trim(),
      to_location: form.to_location.trim(),
      base_price: form.base_price === '' ? null : Number(form.base_price),
      markup_price: form.markup_price === '' ? null : Number(form.markup_price),
      price: finalPrice,
      month_prices: form.month_prices,
    };
    const req = modal.data
      ? updateTransport(modal.data.id, payload)
      : createTransport(payload);
    req
      .then(() => {
        toast(modal.data ? 'Transport updated' : 'Transport added');
        setModal({ open: false, data: null });
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete ${row.transport_type} (${row.from_location} → ${row.to_location})?`)) return;
    deleteTransport(row.id)
      .then(() => {
        toast('Transport deleted');
        load();
      })
      .catch(() => toast('Delete failed', 'error'));
  };

  const grouped = useMemo(() => (
    list.reduce((acc, row) => {
      const key = row.transport_type || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {})
  ), [list]);

  const cityOptions = useMemo(() => {
    const names = Array.from(new Set((cities || []).map((c) => String(c.name || '').trim()).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [cities]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Transport</h1>
        <Button onClick={openAdd}>+ Add Transport</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No transport records. Add your first transport.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([type, rows]) => (
              <details key={type} className="group px-4 sm:px-6 py-3" open>
                <summary className="cursor-pointer list-none flex items-center justify-between py-2">
                  <h2 className="text-sm font-semibold text-slate-800">{type}</h2>
                  <span className="text-xs text-slate-500">{rows.length} routes</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">From</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase">To</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Base</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Markup</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Final</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.transport_type || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{row.from_location || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{row.to_location || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">₹{Number(row.base_price || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">₹{Number(row.markup_price || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">₹{Number(row.price || 0).toLocaleString()}</td>
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
        title={modal.data ? 'Edit Transport' : 'Add Transport'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transport Type *</label>
            <select
              value={form.transport_type}
              onChange={(e) => setForm((prev) => ({ ...prev, transport_type: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              required
            >
              {TRANSPORT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="From Location *"
              value={form.from_location}
              onChange={(e) => setForm((prev) => ({ ...prev, from_location: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To Location *</label>
              <select
                value={form.to_location}
                onChange={(e) => setForm((prev) => ({ ...prev, to_location: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">— Select city —</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Base Price"
              type="number"
              min="0"
              step="0.01"
              value={form.base_price}
              onChange={(e) => {
                const basePrice = e.target.value;
                const finalPrice = computeFinalPrice(basePrice, form.markup_price);
                setForm((prev) => ({
                  ...prev,
                  base_price: basePrice,
                  price: finalPrice ? String(finalPrice) : '',
                  month_prices: syncAllMonthsWithFinal(finalPrice),
                }));
              }}
            />
            <Input
              label="Markup Price"
              type="number"
              min="0"
              step="0.01"
              value={form.markup_price}
              onChange={(e) => {
                const markupPrice = e.target.value;
                const finalPrice = computeFinalPrice(form.base_price, markupPrice);
                setForm((prev) => ({
                  ...prev,
                  markup_price: markupPrice,
                  price: finalPrice ? String(finalPrice) : '',
                  month_prices: syncAllMonthsWithFinal(finalPrice),
                }));
              }}
            />
            <Input
              label="Final Price"
              type="number"
              value={form.price}
              readOnly
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Month-wise Pricing</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MONTHS.map((month) => (
                <div key={month}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{month}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.month_prices?.[month] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        month_prices: {
                          ...(prev.month_prices || {}),
                          [month]: val,
                        },
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
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
