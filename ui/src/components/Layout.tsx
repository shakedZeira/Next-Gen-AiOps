import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { User } from '../types';

export default function Layout({ user }: { user: User | null }) {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-800 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900 dark:bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
