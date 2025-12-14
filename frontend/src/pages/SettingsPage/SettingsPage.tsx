import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './SettingsPage.css';
import epIcon from '../../../EPlogosmall.png';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  // Main app sidebar state (collapsed by default for settings page to give more space)
  const [activeNav, setActiveNav] = useState('settings');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Settings specific state
  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form State
  const [profileData, setProfileData] = useState({
    firstName: user?.name?.split(' ')[0] || 'Uyi',
    lastName: user?.name?.split(' ')[1] || 'Nehikhare',
    email: user?.email || 'uyi@example.com',
    bio: 'Passionate software engineer with 5+ years of experience in building scalable web applications.',
    location: 'San Francisco, CA',
    phone: '+1 (555) 123-4567'
  });

  // Notifications State
  const [notifications, setNotifications] = useState({
    jobAlerts: true,
    applicationUpdates: true,
    weeklySummary: true,
    marketingEmails: false,
  });

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    {
      id: 'profile', label: 'Profile', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    },
    {
      id: 'notifications', label: 'Notifications', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    },
    {
      id: 'security', label: 'Security', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    },
    {
      id: 'preferences', label: 'Preferences', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    },
    {
      id: 'billing', label: 'Billing', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    },
    {
      id: 'privacy', label: 'Privacy', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="settings-panel-content">
            <div className="panel-header">
              <h2>Profile Information</h2>
            </div>

            <div className="profile-photo-section">
              <div className="profile-avatar-large">
                {user?.name?.substring(0, 2).toUpperCase() || 'UN'}
              </div>
              <div className="photo-actions">
                <button className="btn-primary-small">Change Photo</button>
                <span className="photo-hint">JPG, PNG or GIF. Max size 2MB</span>
              </div>
            </div>

            <div className="settings-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  readOnly
                  className="input-readonly"
                />
              </div>

              <div className="form-group full-width">
                <label>Bio</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Application Preferences Section */}
              <div className="edit-preferences-section">
                <div className="preferences-info">
                  <h3>Application Preferences</h3>
                  <p>Update your work authorization, visa status, job preferences, and EEO information.</p>
                </div>
                <button
                  className="btn-edit-preferences"
                  onClick={() => navigate('/onboarding?edit=true')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Preferences
                </button>
              </div>

              <div className="form-actions">
                <button className="btn-secondary">Cancel</button>
                <button className="settings-btn-save">Save Changes</button>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="settings-panel-content">
            <div className="panel-header">
              <h2>Notification Preferences</h2>
            </div>

            <div className="notifications-list">
              <div className="notification-item">
                <div className="notification-info">
                  <h3>Job Alerts</h3>
                  <p>Receive notifications about new job matches</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notifications.jobAlerts}
                    onChange={() => setNotifications({ ...notifications, jobAlerts: !notifications.jobAlerts })}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="notification-item">
                <div className="notification-info">
                  <h3>Application Updates</h3>
                  <p>Get notified when your application status changes</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notifications.applicationUpdates}
                    onChange={() => setNotifications({ ...notifications, applicationUpdates: !notifications.applicationUpdates })}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="notification-item">
                <div className="notification-info">
                  <h3>Weekly Summary</h3>
                  <p>Receive a weekly email with your job search stats</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notifications.weeklySummary}
                    onChange={() => setNotifications({ ...notifications, weeklySummary: !notifications.weeklySummary })}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="notification-item">
                <div className="notification-info">
                  <h3>Marketing Emails</h3>
                  <p>Tips, news and promotional content</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notifications.marketingEmails}
                    onChange={() => setNotifications({ ...notifications, marketingEmails: !notifications.marketingEmails })}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="settings-panel-content placeholder">
            <div className="panel-header">
              <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            </div>
            <div className="coming-soon">
              <p>This section is coming soon.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`settings-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Main App Sidebar */}
      <motion.aside
        className={`settings-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={{ x: -260 }}
        animate={{ x: 0, width: sidebarCollapsed ? 70 : 260 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon"><img src={epIcon} alt="EPIcon" /></div>
          {!sidebarCollapsed && <span className="logo-text">EasePath</span>}
        </div>


        {/* Collapse Toggle */}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarCollapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>

        {/* Main Navigation (Same as Dashboard) */}
        <nav className="sidebar-nav">
          <motion.div className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard', '/dashboard')}>
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg></span>
            {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </motion.div>
          <motion.div className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`} onClick={() => handleNavClick('jobs', '/jobs')}>
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg></span>
            {!sidebarCollapsed && <span className="nav-text">Find Jobs</span>}
          </motion.div>
          <motion.div className={`nav-item ${activeNav === 'auto-apply' ? 'active' : ''}`} onClick={() => handleNavClick('auto-apply', '/auto-apply')}>
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg></span>
            {!sidebarCollapsed && <span className="nav-text">My Applications</span>}
          </motion.div>
          <motion.div className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`} onClick={() => handleNavClick('resume', '/resume')}>
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></span>
            {!sidebarCollapsed && <span className="nav-text">Resume</span>}
          </motion.div>
          <motion.div className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => handleNavClick('settings', '/settings')}>
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></span>
            {!sidebarCollapsed && <span className="nav-text">Settings</span>}
          </motion.div>
        </nav>
      </motion.aside>

      {/* Main Content Area */}
      <main className={`settings-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <div className="settings-page-header">
          <h1>Settings</h1>
          <p>Manage your account settings and preferences</p>
        </div>

        <div className="settings-content-wrapper">
          {/* Settings Menu Sidebar */}
          <div className="settings-menu">
            {menuItems.map(item => (
              <button
                key={item.id}
                className={`settings-menu-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {/* Sign Out Button */}
            <button className="settings-menu-item sign-out" onClick={handleLogout}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>

          {/* Active Settings Panel */}
          <motion.div
            className="settings-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            key={activeTab} // Forces re-animation on tab change
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
