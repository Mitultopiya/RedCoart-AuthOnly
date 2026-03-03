import { useRef } from 'react';

export default function FileUpload({ onSelect, accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp', multiple = false }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const files = e.target.files;
    if (files?.length) onSelect(multiple ? Array.from(files) : files[0]);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
      >
        Choose File
      </button>
    </>
  );
}
