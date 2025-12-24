import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  userId: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth state on mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const authenticated = apiClient.isAuthenticated();

    console.log('[AuthProvider.init] Checking stored auth state:', {
      authenticated,
      storedUsername,
      storedUserId,
    });

    if (authenticated && storedUsername && storedUserId) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
      setUserId(storedUserId);
    }
    setLoading(false);
  }, []);

  const login = async (user: string, pass: string) => {
    console.log('[AuthContext.login] Starting login for user:', user);
    await apiClient.login(user, pass);
    
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const authenticated = apiClient.isAuthenticated();

    console.log('[AuthContext.login] After API, syncing state:', {
      authenticated,
      storedUsername,
      storedUserId,
    });

    setIsAuthenticated(authenticated);
    if (authenticated && storedUsername && storedUserId) {
      setUsername(storedUsername);
      setUserId(storedUserId);
    }
  };

  const register = async (user: string, pass: string) => {
    console.log('[AuthContext.register] Starting registration for user:', user);
    await apiClient.register(user, pass);
    
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const authenticated = apiClient.isAuthenticated();

    console.log('[AuthContext.register] After API, syncing state:', {
      authenticated,
      storedUsername,
      storedUserId,
    });

    setIsAuthenticated(authenticated);
    if (authenticated && storedUsername && storedUserId) {
      setUsername(storedUsername);
      setUserId(storedUserId);
    }
  };

  const logout = async () => {
    console.log('[AuthContext.logout] Logging out');
    await apiClient.logout();
    setIsAuthenticated(false);
    setUsername(null);
    setUserId(null);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, username, userId, login, register, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
