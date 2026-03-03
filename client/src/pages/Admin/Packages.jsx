import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages, deletePackage, uploadBaseUrl } from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/DataTable';
import { useToast } from '../../context/ToastContext';

export default function Packages() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getPackages().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleDelete = (row) => {
    if (!window.confirm(`Delete package "${row.name || row.title}"?`)) return;
    deletePackage(row.id).then(() => { toast('Package deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  const columns = [
    {
      key: 'image_urls',
      label: 'Image',
      render: (r) => {
        const urls = r.image_urls || [];
        const first = urls[0];
        if (!first) return <span className="text-slate-400 text-sm">—</span>;
        const src = first.startsWith('http') ? first : `${uploadBaseUrl}${first}`;
        return (
          <img src={src} alt="" className="w-12 h-12 rounded object-cover border border-slate-200" onError={(e) => { e.target.style.display = 'none'; }} />
        );
      },
    },
    { key: 'name', label: 'Package' },
    { key: 'price', label: 'Price', render: (r) => `₹${Number(r.price || 0).toLocaleString()}` },
    { key: 'duration_days', label: 'Days' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Packages</h1>
        <Button onClick={() => navigate('/admin/package-builder')} className="w-full sm:w-auto">+ Add Package</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={columns}
            data={list}
            emptyMessage="No packages. Create your first package."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/package-builder/${row.id}`)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
}
