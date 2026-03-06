import { useState, useEffect } from 'react';
import { getCompanySettings, updateCompanySettings } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Loading from '../../components/Loading';
import {
  RiBuildingLine, RiBankLine, RiSaveLine, RiRefreshLine,
  RiPhoneLine, RiMailLine, RiMapPinLine, RiShieldLine,
} from 'react-icons/ri';

const FIELDS = {
  company: [
    { key: 'company_name',    label: 'Company Name',    icon: RiBuildingLine, placeholder: 'Vision Travel Hub' },
    { key: 'company_address', label: 'Address',          icon: RiMapPinLine,   placeholder: '123 Street, City, State - 000000', textarea: true },
    { key: 'company_phone',   label: 'Phone',            icon: RiPhoneLine,    placeholder: '+91 98765 43210' },
    { key: 'company_email',   label: 'Email',            icon: RiMailLine,     placeholder: 'info@company.com', type: 'email' },
    { key: 'company_gst',     label: 'GST Number',       icon: RiShieldLine,   placeholder: '22AAAAA0000A1Z5' },
    { key: 'company_website', label: 'Website',          icon: RiBuildingLine, placeholder: 'https://yourcompany.com' },
  ],
  bank: [
    { key: 'bank_name',    label: 'Bank Name',       placeholder: 'State Bank of India' },
    { key: 'bank_account', label: 'Account Number',  placeholder: '000000000000' },
    { key: 'bank_ifsc',    label: 'IFSC Code',       placeholder: 'SBIN0000000' },
    { key: 'bank_upi',     label: 'UPI ID',          placeholder: 'company@upi' },
    { key: 'bank_branch',  label: 'Branch',          placeholder: 'Main Branch' },
  ],
};

function Field({ field, value, onChange }) {
  const Icon = field.icon;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {Icon && <Icon className="inline mr-1.5 text-teal-600 text-sm" />}
        {field.label}
      </label>
      {field.textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none resize-none"
        />
      ) : (
        <input
          type={field.type || 'text'}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
      )}
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getCompanySettings()
      .then((r) => { setForm(r.data || {}); setOriginal(r.data || {}); })
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = () => {
    setSaving(true);
    updateCompanySettings(form)
      .then((r) => { setForm(r.data || form); setOriginal(r.data || form); toast('Settings saved successfully'); })
      .catch(() => toast('Failed to save settings', 'error'))
      .finally(() => setSaving(false));
  };

  const handleReset = () => { setForm({ ...original }); };
  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Company Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Update your company details — used in all PDFs, invoices, and receipts</p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
              <RiRefreshLine /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50"
          >
            <RiSaveLine /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          You have unsaved changes. Click "Save Changes" to apply them.
        </div>
      )}

      {/* Company Info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-600">
          <RiBuildingLine className="text-white text-lg" />
          <h2 className="text-sm font-bold text-white">Company Information</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.company.map((f) => (
            <div key={f.key} className={f.textarea || f.key === 'company_name' ? 'sm:col-span-2' : ''}>
              <Field field={f} value={form[f.key] || ''} onChange={handleChange} />
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
          <RiBankLine className="text-white text-lg" />
          <h2 className="text-sm font-bold text-white">Bank Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.bank.map((f) => (
            <Field key={f.key} field={f} value={form[f.key] || ''} onChange={handleChange} />
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">PDF Header Preview</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <div className="p-6">
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-slate-800 text-base">{form.company_name || 'Company Name'}</p>
              <p className="text-xs text-slate-500 mt-1">{form.company_address || 'Company Address'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{form.company_phone || 'Phone'} &nbsp;|&nbsp; {form.company_email || 'Email'}</p>
              {form.company_gst && <p className="text-xs text-slate-500 mt-0.5">GST No.: {form.company_gst}</p>}
            </div>
            <div className="flex-shrink-0">
              <img
                src="/Vision_JPG_Logo.png"
                alt="logo"
                className="h-12 w-auto object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          </div>
          {(form.bank_name || form.bank_account) && (
            <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                {form.bank_name    && <p><span className="text-slate-400">Bank:</span> {form.bank_name}</p>}
                {form.bank_account && <p><span className="text-slate-400">A/C No:</span> {form.bank_account}</p>}
                {form.bank_ifsc    && <p><span className="text-slate-400">IFSC:</span> {form.bank_ifsc}</p>}
                {form.bank_upi     && <p><span className="text-slate-400">UPI:</span> {form.bank_upi}</p>}
                {form.bank_branch  && <p><span className="text-slate-400">Branch:</span> {form.bank_branch}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save footer */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50 shadow-sm"
        >
          <RiSaveLine className="text-base" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
