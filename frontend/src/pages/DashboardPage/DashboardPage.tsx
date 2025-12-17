import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import epIcon from '../../../EPlogosmall.png';
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
  const [chartPeriod, setChartPeriod] = useState('Week');
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
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/apply/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
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

  // Generate activity data for bar chart based on period and real applications
  const getActivityData = () => {
    const counts: number[] = [];
    const labels: string[] = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (chartPeriod === 'Week') {
      // Current week: Sunday to Saturday
      const dayLabelsWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Find the start of the current week (Sunday)
      const currentDay = now.getDay(); // 0 = Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - currentDay);
      weekStart.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

        const count = applications.filter(app => {
          const appDate = new Date(app.appliedAt);
          return appDate >= dayStart && appDate <= dayEnd;
        }).length;

        counts.push(count);
        labels.push(dayLabelsWeek[i]);
      }
    } else if (chartPeriod === 'Month') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

        const count = applications.filter(app => {
          const appDate = new Date(app.appliedAt);
          return appDate >= weekStart && appDate <= weekEnd;
        }).length;

        counts.push(count);
        labels.push(`Week ${4 - i}`);
      }
    } else {
      // Year - last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const count = applications.filter(app => {
          const appDate = new Date(app.appliedAt);
          return appDate >= monthStart && appDate <= monthEnd;
        }).length;

        counts.push(count);
        labels.push(monthNames[monthDate.getMonth()]);
      }
    }

    // Calculate percentages
    const maxCount = Math.max(...counts, 1);
    const hasData = counts.some(c => c > 0);

    const percentages = counts.map(count => {
      if (!hasData) return 15; // Show placeholder bars when no data
      return count > 0 ? Math.max(Math.round((count / maxCount) * 100), 15) : 8;
    });

    return { data: percentages, labels, rawCounts: counts, hasData, maxCount };
  };

  const chartInfo = getActivityData();
  const activityData = chartInfo.data;
  const dayLabels = chartInfo.labels;

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
          <div className="logo-icon"><img src={epIcon} alt="EPIcon" /></div>
          {!sidebarCollapsed && <span className="logo-text">EasePath</span>}
        </div>

        {/* Collapse Toggle */}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavClick('jobs', '/jobs')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Find Jobs</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'auto-apply' ? 'active' : ''}`}
            onClick={() => handleNavClick('auto-apply', '/auto-apply')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">My Applications</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'resume' ? 'active' : ''}`}
            onClick={() => handleNavClick('resume', '/resume')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Resume</span>}
          </motion.div>

          <motion.div
            className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings', '/settings')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="nav-text">Settings</span>}
          </motion.div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.picture ? (
                <img src={user.picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
              )}
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
        {/* Top Bar */}
        <div className="top-bar">

        </div>

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
            <div className="stat-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
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
            <div className="stat-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-value">{stats.appliedCount}</div>
            <div className="stat-label">Applied</div>
            <span className="stat-change positive">+0% this week</span>
          </motion.div>

          <motion.div
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-value">{stats.pendingCount}</div>
            <div className="stat-label">Pending</div>
            <span className="stat-change positive">+0% this week</span>
          </motion.div>

          <motion.div
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            whileHover={{ y: -4 }}
          >
            <div className="stat-icon purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div className="stat-value">{stats.interviewCount}</div>
            <div className="stat-label">Interviews</div>
            <span className="stat-change positive">+0% this week</span>
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
              <div>
                <h3 className="chart-title">Application Activity</h3>
                <p className="chart-subtitle">Track your weekly progress</p>
              </div>
              <div className="chart-actions">
                {['Week', 'Month', 'Year'].map((period) => (
                  <button
                    key={period}
                    className={`chart-btn ${chartPeriod === period ? 'active' : ''}`}
                    onClick={() => setChartPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="line-chart-container">
              {activityData.map((height, i) => (
                <motion.div
                  key={i}
                  className="chart-bar-wrapper"
                  title={`${chartInfo.rawCounts[i]} application${chartInfo.rawCounts[i] !== 1 ? 's' : ''}`}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    className={`chart-bar ${chartInfo.rawCounts[i] > 0 ? 'has-data' : 'no-data'}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${height}%`, opacity: 1 }}
                    whileHover={{
                      scaleX: 1.1,
                      filter: "brightness(1.3)",
                      transition: { duration: 0.2 }
                    }}
                    transition={{
                      duration: 0.5,
                      delay: 0.6 + i * 0.05
                    }}
                  />
                  <span className="chart-bar-label">{dayLabels[i]}</span>
                </motion.div>
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
              <div>
                <h3 className="chart-title">Status Distribution</h3>
                <p className="chart-subtitle">Current application statuses</p>
              </div>
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
                  <span><span className="legend-dot green"></span>Applied</span>
                  <span className="legend-value">{stats.totalApplications > 0 ? Math.round(stats.appliedCount / stats.totalApplications * 100) : 0}%</span>
                </div>
                <div className="legend-item">
                  <span><span className="legend-dot orange"></span>Pending</span>
                  <span className="legend-value">{stats.totalApplications > 0 ? Math.round(stats.pendingCount / stats.totalApplications * 100) : 0}%</span>
                </div>
                <div className="legend-item">
                  <span><span className="legend-dot purple"></span>Interview</span>
                  <span className="legend-value">{stats.totalApplications > 0 ? Math.round(stats.interviewCount / stats.totalApplications * 100) : 0}%</span>
                </div>
                <div className="legend-item">
                  <span><span className="legend-dot gray"></span>Other</span>
                  <span className="legend-value">{stats.totalApplications > 0 ? Math.round((stats.totalApplications - stats.appliedCount - stats.pendingCount - stats.interviewCount) / stats.totalApplications * 100) : 0}%</span>
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
            <div className="section-header-left">
              <h3 className="section-title">Recent Applications</h3>
              <p className="section-subtitle">{applications.length} total applications</p>
            </div>
            <motion.button
              className="view-all-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/auto-apply')}
            >
              <span className="view-all-icon">+</span> View All
            </motion.button>
          </div>

          <table className="applications-table">
            <thead>
              <tr>
                <th className="sortable">Company <span className="sort-arrow">↕</span></th>
                <th className="sortable">Position <span className="sort-arrow">↕</span></th>
                <th>Status</th>
                <th className="sortable">Match Score <span className="sort-arrow">↕</span></th>
                <th className="sortable">Date <span className="sort-arrow">↕</span></th>
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
                    <div className="match-score-cell">
                      <div className="match-progress-bar">
                        <motion.div
                          className={`match-progress-fill ${app.matchScore >= 85 ? 'high' : app.matchScore >= 70 ? 'medium' : 'low'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${app.matchScore}%` }}
                          transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                        />
                      </div>
                      <span className="match-percentage">{app.matchScore}%</span>
                    </div>
                  </td>
                  <td>{new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {recentApplications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </motion.button>
    </div>
  );
};

export default DashboardPage;
