import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import EmployeeProfile from '../components/employees/EmployeeProfile';
import api from '../services/api';

const EmployeeProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, fieldRes] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get('/custom-fields?module=employees')
      ]);
      setEmployee(empRes.data);
      setFields(fieldRes.data || []);
    } catch (err) {
      console.error('Fetch Profile Error:', err);
      setError('Failed to load employee profile. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={40} className="text-primary-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading employee profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="max-w-4xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-premium border border-slate-100 text-center">
        <div className="w-16 h-16 bg-alert-50 text-alert-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Error Loading Profile</h2>
        <p className="text-slate-600 mb-8">{error || 'Employee not found.'}</p>
        <Button onClick={() => navigate('/employees')} variant="secondary" className="gap-2">
          <ArrowLeft size={18} />
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 mt-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <Button onClick={() => navigate('/employees')} variant="ghost" className="gap-2 text-slate-500 hover:text-slate-900">
          <ArrowLeft size={18} />
          Back to Directory
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-premium overflow-hidden border border-slate-100">
        <EmployeeProfile 
          employee={employee} 
          fields={fields}
          standalone={true}
          onUpdate={fetchData}
        />
      </div>
    </div>
  );
};

export default EmployeeProfilePage;
