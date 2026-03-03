import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FaTimes, FaChevronDown } from 'react-icons/fa';

const base = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors';
const active = 'bg-primary-600 text-white shadow-sm';
const inactive = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

export default function Sidebar({ items, open = false, onClose }) {
  const [logoError, setLogoError] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity md:hidden ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 max-w-[85vw] flex flex-col bg-white border-r border-slate-200 flex-shrink-0 transition-transform duration-200 ease-out md:translate-x-0 md:max-w-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + brand text */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {!logoError ? (
                <>
                  <div className="h-14 w-full flex items-center overflow-hidden">
                    <img
                      src="/Vision_JPG_Logo.png"
                      alt="Vision Travel Hub"
                      className="block max-h-14 w-auto max-w-[220px] object-contain object-left"
                      onError={() => setLogoError(true)}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg font-bold text-slate-800 leading-tight">Vision Travel Hub</span>
                  <span className="text-xs font-medium text-slate-500 tracking-widest uppercase">Since 2017</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden flex-shrink-0"
              aria-label="Close menu"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto min-h-0">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const key = item.to || item.label;

              if (item.children && item.children.length > 0) {
                const isOpen = openGroups[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`${base} ${isOpen ? active : inactive} w-full justify-between`}
                      onClick={() => toggleGroup(key)}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                        <span className="truncate text-left">{item.label}</span>
                      </span>
                      <FaChevronDown
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <ul className="mt-0.5 pl-8 space-y-0.5">
                        {item.children.map((child) => (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              onClick={onClose}
                              className={({ isActive }) =>
                                `${base} ${isActive ? active : inactive} py-2 text-xs`
                              }
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {child.icon && <child.icon className="w-4 h-4 flex-shrink-0" />}
                                <span className="truncate">{child.label}</span>
                              </span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={key}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
                  >
                    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
