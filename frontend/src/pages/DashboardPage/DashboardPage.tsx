import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

interface JobApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  status: string;
  matchScore: number;
  matchReason: string;
  appliedAt: string;
}

interface DashboardStats {
  totalApplications: number;
  appliedCount: number;
  pendingCount: number;
  interviewCount: number;
  weeklyGrowth: number;
}

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    appliedCount: 0,
    pendingCount: 0,
    interviewCount: 0,
    weeklyGrowth: 0
  });

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        // Fetch from the real backend API
        const response = await fetch(`${API_BASE_URL}/api/apply/history`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        
        setApplications(data);
        
        // Calculate stats from real data
        const applied = data.filter((app: JobApplication) => 
          app.status?.toUpperCase() === 'APPLIED'
        ).length;
        const pending = data.filter((app: JobApplication) => 
          app.status?.toUpperCase() === 'PENDING'
        ).length;
        const interview = data.filter((app: JobApplication) => 
          app.status?.toUpperCase() === 'INTERVIEW'
        ).length;
        
        // Calculate weekly growth (applications in last 7 days vs previous 7 days)
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const thisWeek = data.filter((app: JobApplication) => 
          new Date(app.appliedAt) >= oneWeekAgo
        ).length;
        const lastWeek = data.filter((app: JobApplication) => 
          new Date(app.appliedAt) >= twoWeeksAgo && new Date(app.appliedAt) < oneWeekAgo
        ).length;
        
        const growth = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
        
        setStats({
          totalApplications: data.length,
          appliedCount: applied,
          pendingCount: pending,
          interviewCount: interview,
          weeklyGrowth: growth
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching applications:', error);
        // Set empty state when no data or error
        setStats({
          totalApplications: 0,
          appliedCount: 0,
          pendingCount: 0,
          interviewCount: 0,
          weeklyGrowth: 0
        });
        setApplications([]);
        setLoading(false);
      }
    };
    
    fetchApplications();
  }, []);

  const recentApplications = [...applications]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 5);

  // Generate activity data for bar chart based on real applications
  const getActivityData = () => {
    if (applications.length === 0) {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    
    // Get last 12 weeks of data
    const weeks: number[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      
      const count = applications.filter(app => {
        const appDate = new Date(app.appliedAt);
        return appDate >= weekStart && appDate < weekEnd;
      }).length;
      
      weeks.push(count);
    }
    
    // Normalize to percentages (max 100%)
    const maxCount = Math.max(...weeks, 1);
    return weeks.map(count => Math.round((count / maxCount) * 100) || 5);
  };

  const activityData = getActivityData();

  const handleNavClick = (nav: string, path: string) => {
    setActiveNav(nav);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className={`loading-container ${theme}`}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <motion.aside 
        className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
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
            className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavClick('jobs', '/jobs')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">💼</span>
            {!sidebarCollapsed && <span className="nav-text">Find Jobs</span>}
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
            className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`}
            onClick={() => handleNavClick('resume', '/resume')}
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
      <main className={`dashboard-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <motion.div 
          className="dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="header-title">Welcome back, {user?.name?.split(' ')[0] || 'there'}!</h1>
          <p className="header-subtitle">Track your job applications and career progress</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon orange">📊</div>
            <div className="stat-value">{stats.totalApplications}</div>
            <div className="stat-label">Total Applications</div>
            <span className="stat-change positive">+{stats.weeklyGrowth}% this week</span>
          </motion.div>

          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon green">✓</div>
            <div className="stat-value">{stats.appliedCount}</div>
            <div className="stat-label">Applied</div>
            <span className="stat-change positive">+8% this week</span>
          </motion.div>

          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon cyan">⏳</div>
            <div className="stat-value">{stats.pendingCount}</div>
            <div className="stat-label">Pending</div>
            <span className="stat-change negative">-3% this week</span>
          </motion.div>

          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon purple">🎯</div>
            <div className="stat-value">{stats.interviewCount}</div>
            <div className="stat-label">Interviews</div>
            <span className="stat-change positive">+15% this week</span>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <motion.div 
            className="chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <div className="chart-header">
              <h3 className="chart-title">Application Activity</h3>
              <div className="chart-actions">
                <button className="chart-btn active">Week</button>
                <button className="chart-btn">Month</button>
                <button className="chart-btn">Year</button>
              </div>
            </div>
            <div className="line-chart-container">
              {activityData.map((height, i) => (
                <motion.div
                  key={i}
                  className="chart-bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: 0.6 + i * 0.05 }}
                />
              ))}
            </div>
          </motion.div>

          <motion.div 
            className="chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <div className="chart-header">
              <h3 className="chart-title">Status Distribution</h3>
            </div>
            <div className="donut-chart-container">
              <div className="donut-chart">
                <div className="donut-center">
                  <span className="donut-value">{stats.totalApplications}</span>
                  <span className="donut-label">Total</span>
                </div>
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-dot green"></span>
                  Applied ({stats.totalApplications > 0 ? Math.round(stats.appliedCount / stats.totalApplications * 100) : 0}%)
                </div>
                <div className="legend-item">
                  <span className="legend-dot orange"></span>
                  Pending ({stats.totalApplications > 0 ? Math.round(stats.pendingCount / stats.totalApplications * 100) : 0}%)
                </div>
                <div className="legend-item">
                  <span className="legend-dot purple"></span>
                  Interview ({stats.totalApplications > 0 ? Math.round(stats.interviewCount / stats.totalApplications * 100) : 0}%)
                </div>
                <div className="legend-item">
                  <span className="legend-dot gray"></span>
                  Other ({stats.totalApplications > 0 ? Math.round((stats.totalApplications - stats.appliedCount - stats.pendingCount - stats.interviewCount) / stats.totalApplications * 100) : 0}%)
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Applications */}
        <motion.div 
          className="applications-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <div className="section-header">
            <h3 className="section-title">Recent Applications</h3>
            <motion.button 
              className="view-all-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              View All
            </motion.button>
          </div>

          <table className="applications-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Position</th>
                <th>Status</th>
                <th>Match Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentApplications.map((app, index) => (
                <motion.tr 
                  key={app.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                >
                  <td>
                    <div className="company-cell">
                      <div className="company-logo">
                        {app.companyName?.charAt(0) || 'C'}
                      </div>
                      <span className="company-name">{app.companyName || 'Company'}</span>
                    </div>
                  </td>
                  <td>{app.jobTitle || 'Position'}</td>
                  <td>
                    <span className={`status-badge ${app.status.toLowerCase()}`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`match-score ${app.matchScore >= 85 ? 'high' : app.matchScore >= 70 ? 'medium' : 'low'}`}>
                      {app.matchScore}%
                    </span>
                  </td>
                  <td>{new Date(app.appliedAt).toLocaleDateString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {recentApplications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h4 className="empty-title">No applications yet</h4>
              <p className="empty-description">Start applying to jobs to see your progress here</p>
              <motion.button 
                className="empty-action"
                onClick={() => navigate('/auto-apply')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Applying
              </motion.button>
            </div>
          )}
        </motion.div>
      </main>

      {/* Quick Action FAB */}
      <motion.button 
        className="quick-actions-fab"
        onClick={() => navigate('/auto-apply')}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        +
      </motion.button>
    </div>
  );
};

export default DashboardPage;
