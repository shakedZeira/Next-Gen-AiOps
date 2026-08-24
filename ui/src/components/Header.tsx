import { User } from '../types';
import { useTheme } from '../hooks/useTheme';

export default function Header({ user }: { user: User | null }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-900 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Next-Gen AiOps Monitoring</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center text-sm font-medium">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">{user?.email}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
          className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-300"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
