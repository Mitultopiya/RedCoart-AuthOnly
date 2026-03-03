import { useState, useEffect } from 'react';
import { getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation, getCustomers, getPackages, convertQuotationToBooking, downloadQuotationPdf } from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/DataTable';
import { useToast } from '../../context/ToastContext';

const COMPANY = {
  name: 'Vision Travel Hub',
  address: '1234 Street, City, State, Zip Code',
  phone: '123-123-1234',
  email: 'yourcompany@email.com',
  gst: 'GST Number',
};
const TERMS = `Terms and Conditions: By accepting this quotation, you agree to the following terms: Payment is due upon receipt unless otherwise stated. Prices are valid for the validity period stated. Any changes to the scope of work may affect the quoted price and timeline. Our liability is limited to the total amount paid.`;

export default function Quotations() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false });
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    customer_id: '',
    package_id: '',
    valid_until: '',
    discount: '0',
    tax_percent: '0',
    items: [
      { item: 'Hotel Stay', description: '', qty: '1', price: '' },
      { item: 'Transport', description: '', qty: '', price: '' },
    ],
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getQuotations().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getCustomers({ limit: 500 }).then((r) => setCustomers(r.data?.data || r.data || [])).catch(() => {});
    getPackages().then((r) => setPackages(r.data || [])).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      customer_id: '',
      package_id: '',
      valid_until: '',
      discount: '0',
      tax_percent: '0',
      items: [
        { item: 'Hotel Stay', description: '', qty: '1', price: '' },
        { item: 'Transport', description: '', qty: '', price: '' },
      ],
    });
    setModal({ open: true });
  };

  const openEdit = (row) => {
    getQuotation(row.id)
      .then((r) => {
        const q = r.data;
        setForm({
          customer_id: q.customer_id ? String(q.customer_id) : '',
          package_id: q.package_id ? String(q.package_id) : '',
          valid_until: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
          discount: q.discount != null ? String(q.discount) : '0',
          tax_percent: q.tax_percent != null ? String(q.tax_percent) : '0',
          items: (q.items || []).map((it) => ({
            item: '',
            description: it.description || '',
            qty: '1',
            price: String(it.amount || 0),
          })),
        });
        setEditingId(q.id);
        setModal({ open: true });
      })
      .catch(() => toast('Failed to load quotation', 'error'));
  };

  const openDetail = (row) => {
    getQuotation(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load', 'error'));
  };

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { item: '', description: '', qty: '', price: '' }],
    }));
  const updateItem = (i, field, value) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const rowTotal = (row) => {
    const qty = Number(row.qty) || 0;
    const price = Number(row.price) || 0;
    return qty * price;
  };

  const subtotal = form.items.reduce((sum, it) => sum + rowTotal(it), 0);
  const discountValue = Number(form.discount) || 0; // flat for now
  const taxableBase = Math.max(subtotal - discountValue, 0);
  const taxRate = Number(form.tax_percent) || 0;
  const taxAmount = (taxableBase * taxRate) / 100;
  const grandTotal = taxableBase + taxAmount;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.customer_id) { toast('Select customer', 'error'); return; }
    const items = form.items
      .filter((i) => i.item || i.description || i.qty || i.price)
      .map((i) => {
        const total = rowTotal(i);
        const label = i.item || 'Item';
        const desc = i.description ? `${label} - ${i.description}` : label;
        return {
          description: desc,
          amount: total,
        };
      });
    if (packages.length && form.package_id) {
      const pkg = packages.find((p) => p.id === Number(form.package_id));
      if (pkg) items.unshift({ description: `Package: ${pkg.name || pkg.title}`, amount: Number(pkg.price) || 0 });
    }
    const payload = {
      customer_id: Number(form.customer_id),
      package_id: form.package_id ? Number(form.package_id) : null,
      valid_until: form.valid_until || null,
      discount: Number(form.discount) || 0,
      tax_percent: Number(form.tax_percent) || 0,
      items,
    };
    setSaving(true);
    const req = editingId ? updateQuotation(editingId, payload) : createQuotation(payload);
    req
      .then(() => {
        toast(editingId ? 'Quotation updated' : 'Quotation created');
        setModal({ open: false });
        setEditingId(null);
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete quotation #${row.id}?`)) return;
    deleteQuotation(row.id)
      .then(() => {
        toast('Quotation deleted');
        if (detail?.id === row.id) setDetail(null);
        load();
      })
      .catch(() => toast('Delete failed', 'error'));
  };

  const handleConvert = (id) => {
    convertQuotationToBooking(id).then(() => { toast('Booking created from quotation'); setDetail(null); load(); }).catch(() => toast('Failed', 'error'));
  };

  const handleDownloadPdf = (id) => {
    downloadQuotationPdf(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quotation-${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast('PDF downloaded');
      })
      .catch(() => toast('Download failed', 'error'));
  };

  const columns = [
    { key: 'id', label: 'ID', render: (r) => `#${r.id}` },
    { key: 'customer_name', label: 'Customer' },
    { key: 'package_name', label: 'Package' },
    { key: 'total', label: 'Total', render: (r) => `₹${Number(r.total || 0).toLocaleString()}` },
    { key: 'valid_until', label: 'Valid until' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Quotations</h1>
        <Button onClick={openAdd}>+ New Quotation</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={columns}
            data={list}
            emptyMessage="No quotations yet."
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => openDetail(row)}>View</Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>

      <Modal open={modal.open} onClose={() => { setModal({ open: false }); setEditingId(null); }} title={editingId ? 'Edit Quotation' : 'New Quotation'} size="xl">
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Section A – Basic Information */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Valid Until"
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </Card>

          {/* Section B – Package Details */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Package Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Package (optional)</label>
                <select
                  value={form.package_id}
                  onChange={(e) => setForm({ ...form, package_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Section C – Cost Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Cost Breakdown</h3>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>
                + Add Row
              </Button>
            </div>
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 mb-1">
              <div className="col-span-3">Item</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-3">
                    <select
                      value={item.item}
                      onChange={(e) => updateItem(i, 'item', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Custom</option>
                      <option value="Hotel Stay">Hotel Stay</option>
                      <option value="Transport">Transport</option>
                      <option value="Flight">Flight</option>
                      <option value="Activities">Activities</option>
                      <option value="Visa">Visa</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Service Charges">Service Charges</option>
                      <option value="Extra Add-ons">Extra Add-ons</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(i, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateItem(i, 'price', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 text-right text-sm font-medium text-slate-800">
                    ₹{rowTotal(item).toLocaleString()}
                  </div>
                  <div className="md:col-span-12 flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Section D – Price Calculation */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Price Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Discount (₹)</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tax %</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.tax_percent}
                    onChange={(e) => setForm({ ...form, tax_percent: e.target.value })}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tax Amount</span>
                  <span className="font-medium text-slate-800">₹{taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-base mt-1">
                  <span className="font-semibold text-slate-700">Grand Total</span>
                  <span className="text-lg font-bold text-primary-600">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false })}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (editingId ? 'Saving...' : 'Creating...') : editingId ? 'Save Changes' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      </Modal>

      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title="View Quotation" size="xl">
          <div className="bg-white text-slate-800 max-w-4xl mx-auto rounded-lg overflow-hidden print:shadow-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">QUOTATION</h1>
                <p className="text-sm font-semibold text-slate-700 mt-1">{COMPANY.name}</p>
                <p className="text-xs text-slate-600">{COMPANY.address}</p>
                <p className="text-xs text-slate-600">{COMPANY.phone}</p>
                <p className="text-xs text-slate-600">{COMPANY.email}</p>
              </div>
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 bg-slate-50 shrink-0">
                Logo
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
              <div><span className="text-slate-500">Quote No.</span> <span className="font-medium">QTN-{new Date().getFullYear()}-{String(detail.id).padStart(4, '0')}</span></div>
              <div><span className="text-slate-500">Prepared by:</span> —</div>
              <div><span className="text-slate-500">Quote Date:</span> {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'}</div>
              <div><span className="text-slate-500">Due Date:</span> {detail.valid_until || '—'}</div>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-100 px-4 py-3 rounded mb-4">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Customer Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <p><span className="text-slate-500">Name:</span> {detail.customer_name || '—'}</p>
                <p><span className="text-slate-500">Email:</span> {detail.customer_email || '—'}</p>
                <p><span className="text-slate-500">Address:</span> —</p>
                <p><span className="text-slate-500">Phone:</span> {detail.mobile || '—'}</p>
              </div>
            </div>

            {/* Cost breakdown table */}
            <div className="border border-slate-200 rounded overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-4 py-2 font-semibold text-slate-700">Item Description</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-28">Unit Price</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-20">Qty</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{i.description || '—'}</td>
                      <td className="px-4 py-2 text-right">₹{Number(i.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">1</td>
                      <td className="px-4 py-2 text-right font-medium">₹{Number(i.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!detail.items || detail.items.length === 0) && (
                    <tr className="border-t border-slate-100"><td colSpan={4} className="px-4 py-4 text-slate-500 text-center">No line items</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Terms */}
              <div className="flex-1 text-xs text-slate-600 pr-4">
                <h3 className="font-semibold text-slate-700 mb-1">Terms and Conditions</h3>
                <p className="leading-relaxed">{TERMS}</p>
              </div>
              {/* Price summary */}
              <div className="sm:w-56 shrink-0 space-y-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-medium">₹{(detail.items || []).reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">Discount</span><span className="font-medium">₹{Number(detail.discount || 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">Tax ({detail.tax_percent || 0}%)</span><span className="font-medium">—</span></div>
                <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2"><span>Grand Total</span><span className="text-primary-600">₹{Number(detail.total || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Customer Acceptance */}
            <div className="bg-slate-100 px-4 py-3 rounded mb-6">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Customer Acceptance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <p><span className="text-slate-500">Signature:</span> _________________</p>
                <p><span className="text-slate-500">Name:</span> _________________</p>
                <p><span className="text-slate-500">Date:</span> _________________</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200 print:hidden">
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="secondary" onClick={() => openEdit(detail)}>Edit</Button>
              <Button variant="secondary" onClick={() => handleDownloadPdf(detail.id)}>Download PDF</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
