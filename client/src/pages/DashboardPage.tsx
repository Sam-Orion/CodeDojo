import React from 'react';
import { useAppSelector } from '../store';

const DashboardPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.username}!</p>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2>Recent Projects</h2>
          <div className="project-grid">
            <div className="project-card">
              <h3>My First Project</h3>
              <p>JavaScript • Last edited 2 hours ago</p>
            </div>
            <div className="project-card">
              <h3>Python Tutorial</h3>
              <p>Python • Last edited yesterday</p>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button className="action-button">Create New Project</button>
            <button className="action-button">Join Room</button>
            <button className="action-button">Browse Templates</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
