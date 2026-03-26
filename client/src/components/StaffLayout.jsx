import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function StaffLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
