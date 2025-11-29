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

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const authenticated = apiClient.isAuthenticated();

    if (authenticated && storedUsername && storedUserId) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
      setUserId(storedUserId);
    }

    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await apiClient.login(username, password);
    setIsAuthenticated(true);
    setUsername(response.username);
    setUserId(response.userId);
  };

  const register = async (username: string, password: string) => {
    const response = await apiClient.register(username, password);
    setIsAuthenticated(true);
    setUsername(response.username);
    setUserId(response.userId);
  };

  const logout = async () => {
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