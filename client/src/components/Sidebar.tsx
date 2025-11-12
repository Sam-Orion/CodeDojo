import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside
      className={`border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 transition-all ${isOpen ? 'w-64' : 'w-20'}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4">
          <h3
            className={`text-sm font-semibold text-gray-900 dark:text-white overflow-hidden ${isOpen ? '' : 'hidden'}`}
          >
            Navigation
          </h3>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          <SidebarLink
            to="/dashboard"
            icon="📊"
            label="Dashboard"
            isActive={isActive('/dashboard')}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/workspace"
            icon="💻"
            label="Workspace"
            isActive={isActive('/workspace')}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/storage-providers"
            icon="☁️"
            label="Storage"
            isActive={isActive('/storage-providers')}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/terminal"
            icon=">_"
            label="Terminal"
            isActive={isActive('/terminal')}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/settings"
            icon="⚙️"
            label="Settings"
            isActive={isActive('/settings')}
            isOpen={isOpen}
          />
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <p className={`text-xs text-gray-500 dark:text-gray-400 ${isOpen ? '' : 'text-center'}`}>
            {isOpen ? 'v1.0.0' : 'v'}
          </p>
        </div>
      </div>
    </aside>
  );
};

interface SidebarLinkProps {
  to: string;
  icon: string;
  label: string;
  isActive: boolean;
  isOpen: boolean;
}

const SidebarLink = ({ to, icon, label, isActive, isOpen }: SidebarLinkProps) => {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
          : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {isOpen && <span>{label}</span>}
    </Link>
  );
};

export default Sidebar;
