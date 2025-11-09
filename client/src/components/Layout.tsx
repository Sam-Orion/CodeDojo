import React from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { logoutUser } from '../store/slices/authSlice';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';

const Layout: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CodeDojo</h1>
        <nav className="app-nav">
          <div className="nav-items">
            <button>Dashboard</button>
            <button>Rooms</button>
            <button>Profile</button>
            <div className="user-info">
              <span>{user?.username}</span>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </nav>
      </header>

      <main className="app-main">
        <div className="sidebar">
          <h3>File Explorer</h3>
          <div className="file-tree">{/* File tree will be implemented here */}</div>
        </div>

        <div className="editor-area">
          <div className="tabs">{/* Open file tabs will be implemented here */}</div>
          <div className="editor">
            {/* Monaco Editor will be integrated here */}
            <DashboardPage />
          </div>
        </div>

        <div className="right-panel">
          <div className="terminal">
            <h3>Terminal</h3>
            <div className="terminal-content">{/* Terminal will be implemented here */}</div>
          </div>

          <div className="ai-assistant">
            <h3>AI Assistant</h3>
            <div className="ai-content">{/* AI Assistant will be implemented here */}</div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>&copy; 2024 CodeDojo. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;
