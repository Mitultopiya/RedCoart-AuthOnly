import { useState } from 'react';

export default function FormModal({ title, fields, initial, onSave, onClose }) {
  const [values, setValues] = useState(initial);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded">Save</button>
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
