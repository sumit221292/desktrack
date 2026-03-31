import React, { useState } from 'react';
import { Mail, Phone, Calendar, Shield, MapPin, Briefcase, Clock, FileText, User, X, List, Edit2, Save, ArrowLeft } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import DynamicForm from '../forms/DynamicForm';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const DetailItem = ({ icon: Icon, label, value, color = "text-slate-500" }) => (
  <div className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
    <div className={`p-2 rounded-lg bg-slate-100 ${color} shrink-0`}>
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words">{value || 'Not provided'}</p>
    </div>
  </div>
);

const EmployeeProfile = ({ employee, fields, onUpdate }) => {
  const { user, hasPermission } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!employee) return null;

  const STANDARD_KEYS = new Set([
    'first_name', 'last_name', 'email', 'employee_code',
    'designation_id', 'department_id', 'salary_info', 'joining_date',
    'shift_id', 'role', 'status'
  ]);

  const handleEditSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      // Split standard vs custom field values
      const standard = {};
      const customDbIds = {};
      Object.entries(values).forEach(([key, val]) => {
        if (STANDARD_KEYS.has(key)) {
          standard[key] = val;
        } else {
          const fieldDef = fields.find(f => f.id === key || f.field_id === key);
          if (fieldDef && fieldDef.db_id) {
            customDbIds[fieldDef.db_id] = val;
          }
        }
      });

      await api.put(`/employees/${employee.id}`, { ...standard, custom_field_values: customDbIds });

      // If the current user's role was changed, update the session immediately
      if (user && employee.email === user.email && values.role && values.role !== user.role) {
        const updatedUser = { ...user, role: values.role };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
        return;
      }

      if (onUpdate) await onUpdate();
      setIsEditing(false);
    } catch (err) {
      console.error('Update Profile Error:', err);
      alert('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group fields to display nicely
  const standardFields = [
    { icon: Mail, label: 'Email Address', value: employee.email, id: 'email' },
    { icon: Briefcase, label: 'Employee ID', value: employee.employee_code, id: 'employee_code' },
    { icon: Shield, label: 'Designation', value: employee.designation_name, id: 'designation_id' },
    { icon: MapPin, label: 'Department', value: employee.department_name, id: 'department_id' },
    { icon: Clock, label: 'Assigned Shift', value: employee.shift_name, id: 'shift_id' },
    { icon: Calendar, label: 'Joining Date', value: employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'N/A', id: 'joining_date' },
  ];

  // Identifiers for custom fields that aren't in the standard list above
  const standardIds = ['email', 'employee_code', 'first_name', 'last_name', 'designation_id', 'department_id', 'shift_id', 'joining_date', 'status', 'role'];
  const customFieldsToDisplay = fields?.filter(f => !standardIds.includes(f.field_id)) || [];

  return (
    <div className="flex flex-col bg-white overflow-hidden min-h-[600px]">
      {/* Header / Cover */}
      <div className="relative h-40 bg-gradient-to-r from-primary-600 to-indigo-700">
        <div className="absolute -bottom-14 left-8 p-1 bg-white rounded-2xl shadow-xl ring-4 ring-white transition-transform hover:scale-105 duration-300">
          <div className="w-28 h-28 rounded-xl bg-slate-100 flex items-center justify-center text-4xl font-bold text-primary-700">
            {(employee.first_name || '?')[0]}{(employee.last_name || '?')[0]}
          </div>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="pt-20 px-8 pb-8 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 font-display flex items-center gap-4">
              {employee.first_name} {employee.last_name}
              <Badge variant={employee.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'warning'} className="text-sm px-3 py-1">
                {employee.status}
              </Badge>
            </h2>
            <p className="text-slate-500 font-medium mt-2 flex items-center gap-2 flex-wrap">
              <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-primary-100">{employee.role}</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">{employee.designation_name}</span> 
              <span className="text-slate-400 font-normal">in</span>
              <span className="font-semibold text-slate-700">{employee.department_name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              hasPermission('employees', 'edit') && <Button onClick={() => setIsEditing(true)} className="gap-2 px-6 shadow-md shadow-primary-500/20">
                <Edit2 size={16} />
                Edit Profile
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(false)} variant="secondary" className="gap-2 px-6 text-slate-600">
                <ArrowLeft size={16} />
                Cancel Editing
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 bg-slate-50/10">
        {isEditing ? (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Edit Employee Information</h3>
            <DynamicForm 
              fields={fields} 
              initialValues={employee} 
              onSubmit={handleEditSubmit} 
              isLoading={isSubmitting}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* Left Column: Basic Details */}
              <div className="lg:col-span-2 space-y-10">
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3 px-1">
                    <span className="w-1 h-3 bg-primary-500 rounded-full"></span>
                    <User size={14} className="text-primary-500" /> Core Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-2 rounded-2xl">
                    {standardFields.map((field, idx) => (
                      <DetailItem key={idx} {...field} />
                    ))}
                  </div>
                </section>

                {customFieldsToDisplay.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3 px-1">
                      <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                      <FileText size={14} className="text-indigo-500" /> Additional Records
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-2 rounded-2xl">
                      {customFieldsToDisplay.map((field) => (
                        <DetailItem 
                          key={field.id} 
                          icon={field.field_type === 'date' ? Calendar : field.field_type === 'dropdown' ? List : FileText} 
                          label={field.field_name}
                          value={employee[field.field_id]}
                          color="text-indigo-500"
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Right Column: Mini Widgets */}
              <div className="space-y-8">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-6 tracking-wider text-center flex items-center justify-center gap-2">
                    <Clock size={12} /> Work Summary
                  </h4>
                  <div className="space-y-6">
                    <div className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-50/50">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Current Shift</span>
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {employee.shift_name}
                      </span>
                    </div>
                    <div className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-50/50">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Join Date</span>
                      <span className="font-bold text-slate-800 text-sm">{employee.joining_date ? new Date(employee.joining_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeProfile;
