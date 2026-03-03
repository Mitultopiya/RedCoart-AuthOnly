import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPackage,
  createPackage,
  updatePackage,
  savePackageDays,
  getHotels,
  uploadPackageFile,
  uploadBaseUrl,
} from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { FaPlus, FaTrash, FaImage } from 'react-icons/fa';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

function imageSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${uploadBaseUrl}${url}`;
}

export default function PackageBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_days: '1' });
  const [imageUrls, setImageUrls] = useState([]);
  const [days, setDays] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (isEdit) {
      getPackage(id)
        .then((r) => {
          const d = r.data;
          setForm({
            name: d.name || d.title || '',
            description: d.description || '',
            price: d.price ?? '',
            duration_days: String(d.duration_days ?? d.days ?? 1),
          });
          setImageUrls(Array.isArray(d.image_urls) ? [...d.image_urls] : []);
          setDays(
            Array.isArray(d.days)
              ? d.days.map((x) => ({ ...x, hotel_id: x.hotel_id || null }))
              : []
          );
        })
        .catch(() => toast('Failed to load package', 'error'))
        .finally(() => setLoading(false));
    }
    getHotels().then((r) => setHotels(r.data || [])).catch(() => {});
  }, [id, isEdit, toast]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      duration_days: Number(form.duration_days) || 1,
      image_urls: imageUrls,
    };
    (isEdit ? updatePackage(id, payload) : createPackage(payload))
      .then((r) => {
        const pkgId = r.data.id;
        if (days.length) savePackageDays(pkgId, days).catch(() => {});
        toast(isEdit ? 'Package updated' : 'Package created');
        if (!isEdit) navigate(`/admin/package-builder/${pkgId}`);
        else setSaving(false);
      })
      .catch((err) => {
        toast(err.response?.data?.message || 'Failed', 'error');
        setSaving(false);
      });
  };

  const handleImageSelect = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imageFiles.length) {
      toast('Please select image files (JPG, PNG, GIF, WebP)', 'error');
      e.target.value = '';
      return;
    }
    setUploading(true);
    let added = 0;
    try {
      for (const file of imageFiles) {
        const { data } = await uploadPackageFile(file);
        const url = data.url || '';
        if (url) {
          setImageUrls((prev) => [...prev, url]);
          added++;
        }
      }
      if (added) toast(`Uploaded ${added} image${added > 1 ? 's' : ''}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      toast(msg, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index) => setImageUrls((prev) => prev.filter((_, i) => i !== index));

  const addDay = () =>
    setDays((d) => [...d, { day_number: d.length + 1, activities: '', hotel_id: null, meals: '', transport: '', notes: '' }]);
  const updateDay = (i, field, value) =>
    setDays((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [field]: value };
      return n;
    });
  const removeDay = (i) =>
    setDays((prev) => prev.filter((_, j) => j !== i).map((d, j) => ({ ...d, day_number: j + 1 })));

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{isEdit ? 'Edit Package' : 'New Package'}</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/packages')} className="w-full sm:w-auto">
          ← Back to list
        </Button>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <Card title="Package details">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Package name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Price (₹) *"
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              <Input
                label="Duration (days) *"
                type="number"
                min="1"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : isEdit ? 'Update Package' : 'Create Package'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/packages')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Package images">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
              >
                <FaImage className="inline w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload images'}
              </Button>
              <span className="text-sm text-slate-500">JPG, PNG, GIF or WebP (max 5MB each)</span>
            </div>
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {imageUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="relative group rounded-lg border border-slate-200 overflow-hidden bg-slate-100 aspect-square"
                  >
                    <img
                      src={imageSrc(url)}
                      alt={`Package ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '';
                        e.target.style.background = '#f1f5f9';
                        e.target.style.minHeight = '80px';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      aria-label="Remove image"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No images yet. Click &quot;Upload images&quot; to add photos for this package.</p>
            )}
          </div>
        </Card>

        <Card
          title="Day-wise itinerary"
          action={
            <Button size="sm" onClick={addDay}>
              <FaPlus className="w-4 h-4 mr-1" /> Add day
            </Button>
          }
        >
          <div className="space-y-4">
            {days.map((d, i) => (
              <div key={i} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">Day {d.day_number}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeDay(i)}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Activities"
                    value={d.activities}
                    onChange={(e) => updateDay(i, 'activities', e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Hotel</label>
                    <select
                      value={d.hotel_id || ''}
                      onChange={(e) => updateDay(i, 'hotel_id', e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">— None —</option>
                      {hotels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input placeholder="Meals" value={d.meals} onChange={(e) => updateDay(i, 'meals', e.target.value)} />
                  <Input placeholder="Transport" value={d.transport} onChange={(e) => updateDay(i, 'transport', e.target.value)} />
                </div>
                <Input placeholder="Notes" value={d.notes} onChange={(e) => updateDay(i, 'notes', e.target.value)} />
              </div>
            ))}
            {days.length === 0 && (
              <p className="text-slate-500 text-sm">No days added. Click &quot;Add day&quot; to build the itinerary.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
