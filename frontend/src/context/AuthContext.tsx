import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isTokenExpired } from '../utils/apiClient';

interface User {
  email: string;
  name: string;
  picture: string;
  googleId?: string;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    const authToken = localStorage.getItem('auth_token');
    // Only restore user if both user data and auth token exist
    if (storedUser && authToken) {
      return JSON.parse(storedUser);
    }
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check both user and token exist for persistent authentication
    const storedUser = localStorage.getItem('user');
    const authToken = localStorage.getItem('auth_token');
    return !!(storedUser && authToken);
  });

  // Check token expiration on app startup and periodically
  useEffect(() => {
    const checkAndLogout = () => {
      if (isAuthenticated && isTokenExpired()) {
        console.warn('Token expired on startup. Logging out...');
        logout();
      }
    };

    // Check immediately on mount
    checkAndLogout();

    // Also check every minute while app is open
    const interval = setInterval(checkAndLogout, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const login = (userData: User) => {
    // Check if user has a custom profile picture stored (by email)
    const customPicture = localStorage.getItem(`easepath_pfp_${userData.email}`);
    const finalUserData = customPicture
      ? { ...userData, picture: customPicture }
      : userData;

    localStorage.setItem('user', JSON.stringify(finalUserData));
    // Also store email separately for extension sync
    localStorage.setItem('easepath_user_email', finalUserData.email);
    setIsAuthenticated(true);
    setUser(finalUserData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('easepath_user_email');
    // Note: We keep the custom profile picture stored by email so it persists
    setIsAuthenticated(false);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // If updating picture, also store it separately by email for persistence across logins
      if (updates.picture && user.email) {
        localStorage.setItem(`easepath_pfp_${user.email}`, updates.picture);
      }

      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
