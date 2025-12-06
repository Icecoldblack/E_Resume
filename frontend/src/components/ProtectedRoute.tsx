import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Not logged in - redirect to home
  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Check for edit mode on onboarding page
  const isEditMode = location.pathname === '/onboarding' && location.search.includes('edit=true');

  // On onboarding page in edit mode - allow access even if completed
  if (isEditMode) {
    return <Outlet />;
  }

  // Logged in but hasn't completed onboarding - redirect to onboarding
  // (unless already on the onboarding page)
  if (!user?.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // On onboarding page but already completed (and not in edit mode) - redirect to dashboard
  if (user?.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
