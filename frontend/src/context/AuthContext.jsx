import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(() => {
    return localStorage.getItem('isCheckedIn') === 'true';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('selectedDate') || new Date().toISOString().split('T')[0];
  });
  const [shifts, setShifts] = useState([]);
  const [enabledModules, setEnabledModules] = useState(() => {
    const saved = localStorage.getItem('enabledModules');
    return saved ? JSON.parse(saved) : {
      employees: true,
      attendance: true,
      leaves: true,
      payroll: true,
      reports: true,
      performance: true
    };
  });

  useEffect(() => {
    localStorage.setItem('enabledModules', JSON.stringify(enabledModules));
  }, [enabledModules]);

  // Fetch shifts only for authenticated users
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const response = await api.get('/shifts');
        setShifts(response.data);
      } catch (err) {
        console.error('Initial Shifts Load Error:', err);
      }
    };

    if (user && !loading) {
      fetchShifts();
    }
  }, [user, loading]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const domain = email.split('@')[1];
      const tenant = domain ? domain.split('.')[0] : 'default-tenant';
      
      const response = await api.post('/auth/login', { email, password }, {
        headers: { 'x-tenant-slug': tenant }
      });
      
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('tenantSlug', tenant);
      
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Login Error:', err);
      throw err;
    }
  };

  const googleLogin = async (credential) => {
    try {
      const response = await api.post('/auth/google', { credential });
      
      const { token, user: userData, tenantSlug } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('tenantSlug', tenantSlug);
      
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Google Login Error:', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isCheckedIn');
    localStorage.removeItem('tenantSlug');
    setUser(null);
    setShifts([]);
    setIsCheckedIn(false);
  };

  const toggleCheckIn = () => {
    const newState = !isCheckedIn;
    setIsCheckedIn(newState);
    localStorage.setItem('isCheckedIn', newState);
  };

  const handleSetSelectedDate = (date) => {
    setSelectedDate(date);
    localStorage.setItem('selectedDate', date);
  };

  const handleUpdateShifts = (newShifts) => {
    setShifts(newShifts);
  };

  return (
    <AuthContext.Provider value={{ 
      user, login, googleLogin, logout, loading, 
      isCheckedIn, toggleCheckIn,
      selectedDate, setSelectedDate: handleSetSelectedDate,
      shifts, setShifts: handleUpdateShifts,
      enabledModules, setEnabledModules
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
