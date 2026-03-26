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
    // Use local date instead of UTC to avoid date shifting (especially late at night)
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [attendanceId, setAttendanceId] = useState(() => {
    return localStorage.getItem('attendanceId');
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

  // Sync attendance status from backend on load or user change
  useEffect(() => {
    const syncAttendanceStatus = async () => {
      if (!user) return;
      try {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const response = await api.get(`/attendance?date=${today}`);
        const myRecord = response.data.find(r => r.email === user.email || r.employee_id === user.id);
        
        if (myRecord && myRecord.is_checked_in && !String(myRecord.id).startsWith('dummy-')) {
          setIsCheckedIn(true);
          setAttendanceId(myRecord.id);
          localStorage.setItem('isCheckedIn', 'true');
          localStorage.setItem('attendanceId', myRecord.id);
        } else {
          setIsCheckedIn(false);
          setAttendanceId(null);
          localStorage.removeItem('isCheckedIn');
          localStorage.removeItem('attendanceId');
        }
      } catch (err) {
        console.error('Failed to sync attendance status:', err);
      }
    };

    if (user && !loading) {
      syncAttendanceStatus();
    }
  }, [user, loading, selectedDate]);

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

  /*
   * Bug Fixes / Tasks:
   * - [x] Implement Google Domain Approval system and premium settings UI
   * - [/] Fix Google Login hang (COOP header)
   * - [/] Fix Dashboard stale date and crash protection
   * - [ ] Verify both fixes in browser
   */
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
    localStorage.removeItem('attendanceId');
    localStorage.removeItem('tenantSlug');
    setUser(null);
    setShifts([]);
    setIsCheckedIn(false);
    setAttendanceId(null);
  };

  const toggleCheckIn = async () => {
    try {
      if (!isCheckedIn) {
        // Checking In
        const response = await api.post('/attendance/check-in', {
          location: { type: 'web', browser: navigator.userAgent }
        });
        const record = response.data;
        setIsCheckedIn(true);
        setAttendanceId(record.id);
        localStorage.setItem('isCheckedIn', 'true');
        localStorage.setItem('attendanceId', record.id);
      } else {
        // Checking Out
        if (!attendanceId) {
          // Fallback: try to find the record first if ID is missing from local state
          const d = new Date();
          const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const statusRes = await api.get(`/attendance?date=${today}`);
          const myRecord = statusRes.data.find(r => r.email === user.email && !r.check_out && !String(r.id).startsWith('dummy-'));
          if (myRecord) {
            await api.post(`/attendance/check-out/${myRecord.id}`, {});
          }
        } else {
          await api.post(`/attendance/check-out/${attendanceId}`, {});
        }
        
        setIsCheckedIn(false);
        setAttendanceId(null);
        localStorage.removeItem('isCheckedIn');
        localStorage.removeItem('attendanceId');
      }
    } catch (err) {
      console.error('Attendance Action Error:', err);
      alert(err.response?.data?.error || 'Failed to process attendance action');
    }
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
