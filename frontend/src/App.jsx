import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import Attendance from './pages/Attendance';
import AttendanceCalendar from './pages/AttendanceCalendar';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="employees" element={<EmployeeManagement />} />
            <Route path="employees/:id" element={<EmployeeProfilePage />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="attendance-calendar" element={<AttendanceCalendar />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="performance" element={<Performance />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
