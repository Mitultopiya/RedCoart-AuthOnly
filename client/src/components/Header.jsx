import { getStoredUser, logout } from '../utils/auth';
import Button from './ui/Button';
import { FaBars } from 'react-icons/fa';

export default function Header({ onMenuClick }) {
  const user = getStoredUser();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-card">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 min-w-0">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Open menu"
            >
              <FaBars className="w-6 h-6" />
            </button>
          )}
          <div className="w-2 h-6 rounded-full bg-primary-500 hidden sm:block flex-shrink-0" />
          <span className="text-slate-500 text-sm font-medium truncate">Admin Panel</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
