import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import AutoApplyPage from './pages/AutoApplyPage';

const App: React.FC = () => {
  return (
    <div className="app-root">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/auto-apply" element={<AutoApplyPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App
