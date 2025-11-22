import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-grid">
        <article className="dashboard-card">
          <h3>Weekly Applications</h3>
          <p>12 jobs submitted</p>
        </article>
        <article className="dashboard-card">
          <h3>Interviews Scheduled</h3>
          <p>3 upcoming next week</p>
        </article>
        <article className="dashboard-card">
          <h3>AI Credits</h3>
          <p>62 remaining</p>
        </article>
      </section>

      <section className="dashboard-settings" id="settings">
        <header>
          <h3>Settings</h3>
          <p>Manage your EasePath account and authentication.</p>
        </header>
        <div className="settings-actions">
          <button type="button" onClick={handleSignOut}>
            Sign out and return to login
          </button>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
