import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from '../store';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import MainLayout from '../components/layouts/MainLayout';
import SettingsPage from '../pages/SettingsPage';
import WorkspacePage from '../pages/WorkspacePage';

const Router = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {isAuthenticated ? (
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspace/:roomId" element={<WorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
};

export default Router;
