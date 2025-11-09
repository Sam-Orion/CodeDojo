import { Link } from 'react-router-dom';
import { User } from '../types';
import Button from './ui/Button';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header = ({ user, onLogout }: HeaderProps) => {
  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-primary-600 to-primary-400 px-3 py-1 text-xl font-bold text-white rounded-md">
            CodeDojo
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="text-sm font-medium text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
          >
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
