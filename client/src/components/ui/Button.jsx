export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm shadow-primary-500/20',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
  };
  const sizes = { sm: 'px-3 py-2 sm:py-1.5 text-sm min-h-[36px] sm:min-h-0', md: 'px-4 py-2.5 sm:py-2 text-sm min-h-[44px] sm:min-h-0', lg: 'px-6 py-3 text-base min-h-[48px]' };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
