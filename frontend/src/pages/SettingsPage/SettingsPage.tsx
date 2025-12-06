import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeNav, setActiveNav] = useState('settings');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    updates: true,
  });
  const [autoApply, setAutoApply] = useState({
    enabled: true,
    maxPerDay: 25,
    preferRemote: true,
  });
  
  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [currentResume, setCurrentResume] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Fetch current resume info
    fetchCurrentResume();
  }, []);

  const fetchCurrentResume = async () => {
    try {
      const userEmail = user?.email || localStorage.getItem('easepath_user_email');
      if (!userEmail) return;
      
      const response = await fetch(`http://localhost:8080/api/resume/${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.fileName) {
          setCurrentResume(data.fileName);
        }
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      setResumeMessage({ type: 'error', text: 'Please select a resume file first' });
      return;
    }

    setUploadingResume(true);
    setResumeMessage(null);

    try {
      const userEmail = user?.email || localStorage.getItem('easepath_user_email');
      if (!userEmail) {
        setResumeMessage({ type: 'error', text: 'User not logged in' });
        setUploadingResume(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('userEmail', userEmail);

      const response = await fetch('http://localhost:8080/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setResumeMessage({ type: 'success', text: result.message || 'Resume uploaded successfully!' });
        setCurrentResume(resumeFile.name);
        setResumeFile(null);
        // Reset file input
        const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        let errorMessage = 'Failed to upload resume';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        setResumeMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      setResumeMessage({ type: 'error', text: 'Error uploading resume. Please try again.' });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        setResumeMessage({ type: 'error', text: 'Please upload a PDF or Word document' });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setResumeMessage({ type: 'error', text: 'File size must be less than 5MB' });
        return;
      }
      setResumeFile(file);
      setResumeMessage(null);
    }
  };

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={`settings-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar - Same as Dashboard */}
      <motion.aside 
        className={`settings-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={{ x: -260 }}
        animate={{ x: 0, width: sidebarCollapsed ? 70 : 260 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">EP</div>
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

        <nav className="sidebar-nav">
          <motion.div 
            className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard', '/dashboard')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">📊</span>
            {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'auto-apply' ? 'active' : ''}`}
            onClick={() => handleNavClick('auto-apply', '/auto-apply')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">🚀</span>
            {!sidebarCollapsed && <span className="nav-text">Auto Apply</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavClick('jobs', '/dashboard')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">💼</span>
            {!sidebarCollapsed && <span className="nav-text">Jobs</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`}
            onClick={() => handleNavClick('resume', '/settings')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">📄</span>
            {!sidebarCollapsed && <span className="nav-text">Resume</span>}
          </motion.div>
          
          <motion.div 
            className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings', '/settings')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">⚙️</span>
            {!sidebarCollapsed && <span className="nav-text">Settings</span>}
          </motion.div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={handleLogout}>
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <span className="user-email">{user?.email || 'user@email.com'}</span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`settings-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <motion.div 
          className="settings-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1>Settings</h1>
          <p>Manage your account preferences and application settings</p>
        </motion.div>

        <div className="settings-grid">
          {/* Appearance Card */}
          <motion.div 
            className="settings-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="card-header">
              <div className="card-icon appearance-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
              <h3>Appearance</h3>
            </div>
            <div className="card-content">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Dark Mode</span>
                  <span className="setting-description">Switch between light and dark theme</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isDark}
                    onChange={toggleTheme}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="theme-preview">
                <div className={`preview-box ${isDark ? 'dark-preview' : 'light-preview'}`}>
                  <span>{isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Notifications Card */}
          <motion.div 
            className="settings-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="card-header">
              <div className="card-icon notifications-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3>Notifications</h3>
            </div>
            <div className="card-content">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Email Notifications</span>
                  <span className="setting-description">Receive job alerts via email</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={() => setNotifications({ ...notifications, email: !notifications.email })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Push Notifications</span>
                  <span className="setting-description">Browser push notifications</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.push}
                    onChange={() => setNotifications({ ...notifications, push: !notifications.push })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Product Updates</span>
                  <span className="setting-description">News about new features</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.updates}
                    onChange={() => setNotifications({ ...notifications, updates: !notifications.updates })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </motion.div>

          {/* Auto Apply Settings Card */}
          <motion.div 
            className="settings-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="card-header">
              <div className="card-icon autoapply-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3>Auto Apply</h3>
            </div>
            <div className="card-content">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Enable Auto Apply</span>
                  <span className="setting-description">Automatically apply to matching jobs</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={autoApply.enabled}
                    onChange={() => setAutoApply({ ...autoApply, enabled: !autoApply.enabled })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Max Applications/Day</span>
                  <span className="setting-description">Limit daily applications</span>
                </div>
                <div className="number-input">
                  <button onClick={() => setAutoApply({ ...autoApply, maxPerDay: Math.max(1, autoApply.maxPerDay - 5) })}>-</button>
                  <span>{autoApply.maxPerDay}</span>
                  <button onClick={() => setAutoApply({ ...autoApply, maxPerDay: Math.min(100, autoApply.maxPerDay + 5) })}>+</button>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Prefer Remote Jobs</span>
                  <span className="setting-description">Prioritize remote opportunities</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={autoApply.preferRemote}
                    onChange={() => setAutoApply({ ...autoApply, preferRemote: !autoApply.preferRemote })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </motion.div>

          {/* Resume Card - NEW */}
          <motion.div 
            className="settings-card resume-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="card-header">
              <div className="card-icon resume-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3>Resume</h3>
            </div>
            <div className="card-content">
              {currentResume && (
                <div className="current-resume">
                  <div className="resume-info">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="resume-name">{currentResume}</span>
                  </div>
                  <span className="resume-status">✓ Uploaded</span>
                </div>
              )}
              
              <div className="resume-upload-section">
                <label htmlFor="resume-upload" className="upload-label">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{resumeFile ? resumeFile.name : 'Choose a file or drag it here'}</span>
                  <span className="upload-hint">PDF, DOC, DOCX (max 5MB)</span>
                </label>
                <input 
                  type="file" 
                  id="resume-upload" 
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  hidden
                />
              </div>

              {resumeMessage && (
                <div className={`resume-message ${resumeMessage.type}`}>
                  {resumeMessage.text}
                </div>
              )}

              <button 
                className="upload-btn"
                onClick={handleResumeUpload}
                disabled={!resumeFile || uploadingResume}
              >
                {uploadingResume ? (
                  <>
                    <span className="spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {currentResume ? 'Update Resume' : 'Upload Resume'}
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Profile Card - Edit your job seeker profile */}
          <motion.div 
            className="settings-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <div className="card-header">
              <div className="card-icon profile-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <h3>Job Seeker Profile</h3>
            </div>
            <div className="card-content">
              <p className="profile-description">
                Update your personal information, work authorization, education, and job preferences. This data is used to auto-fill job applications.
              </p>
              <button 
                className="settings-btn primary edit-profile-btn"
                onClick={() => navigate('/onboarding?edit=true')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Profile
              </button>
            </div>
          </motion.div>

          {/* Account Card - Simplified for Google sign-in */}
          <motion.div 
            className="settings-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="card-header">
              <div className="card-icon account-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3>Account</h3>
            </div>
            <div className="card-content">
              <div className="account-info">
                <div className="account-detail">
                  <span className="detail-label">Signed in with</span>
                  <div className="google-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Google Account</span>
                  </div>
                </div>
                <div className="account-detail">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{user?.email || 'user@email.com'}</span>
                </div>
              </div>
              
              <button className="settings-btn danger" onClick={handleLogout}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
