import { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full sm:rounded-xl ${sizes[size]} bg-white shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-xl sm:rounded-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 truncate pr-2">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex-shrink-0" aria-label="Close">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0">{children}</div>
      </div>
    </div>
  );
}
