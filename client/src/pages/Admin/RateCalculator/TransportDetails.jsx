import Card from './Card';

export default function TransportDetails({ transports, setTransports, transportOptions = [] }) {
  const updateTransport = (idx, key, value) => {
    setTransports((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  };

  const addTransport = () => {
    setTransports((prev) => [...prev, { transport: '', quantity: '1' }]);
  };

  return (
    <Card title="Transport Details">
      <div className="space-y-2">
        {transports.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-600 mb-1">Transport</label>
              <select
                value={row.transport}
                onChange={(e) => updateTransport(idx, 'transport', e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">Select transport</option>
                {transportOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateTransport(idx, 'quantity', e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div className="md:col-span-3 flex items-end">
              <button
                type="button"
                onClick={addTransport}
                className="h-10 px-4 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
