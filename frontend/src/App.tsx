import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage/HomePage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import AutoApplyPage from './pages/AutoApplyPage/AutoApplyPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app-root">
      {isAuthenticated && <Navbar />}
      <main className="app-main" data-authenticated={isAuthenticated}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/auto-apply" element={<AutoApplyPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
};

export default App;
