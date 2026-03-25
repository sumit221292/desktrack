import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Shield, Layout, Database, Users, Clock, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { motion } from 'framer-motion';

const Settings = () => {
  const { shifts, setShifts, enabledModules, setEnabledModules } = useAuth();
  const [activeTab, setActiveTab] = useState('shifts');
  const [showModal, setShowModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editingShift, setEditingShift] = useState(null);

  // Custom Fields Data
  const [customFields, setCustomFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    const fetchFields = async () => {
      setLoadingFields(true);
      try {
        const response = await api.get('/custom-fields?module=employees');
        setCustomFields(response.data);
      } catch (err) {
        console.error('Error fetching custom fields:', err);
      } finally {
        setLoadingFields(false);
      }
    };
    fetchFields();
  }, []);

  const [formData, setFormData] = useState({
    moduleName: 'Employees', fieldName: '', fieldType: 'text', isRequired: false, options: ''
  });

  // Modules metadata
  const moduleMetadata = [
    { id: 'employees', name: 'Employees', description: 'Core employee directory and profiles', icon: Users },
    { id: 'attendance', name: 'Attendance', description: 'Track check-ins, check-outs and shifts', icon: Clock },
    { id: 'leaves', name: 'Leaves', description: 'Leave application and approval flow', icon: CalendarIcon },
    { id: 'payroll', name: 'Payroll', description: 'Salary processing and payslips', icon: Database },
    { id: 'reports', name: 'Reports', description: 'Advanced analytics and PDF exports', icon: Layout },
    { id: 'performance', name: 'Performance', description: 'KPIs and appraisals (Beta)', icon: TrendingUp },
  ];

  // Roles and Shifts are now handled or will be handled via global state/context for demo persistence
  const [roles, setRoles] = useState([
    { id: '1', name: 'Super Admin', description: 'Full access to all modules and system settings.', userCount: 0, permissions: { employees: ['view', 'create', 'edit', 'delete'], attendance: ['view', 'create', 'edit', 'delete'], leaves: ['view', 'approve', 'reject'], payroll: ['view', 'edit', 'approve'] } },
    { id: '2', name: 'HR Manager', description: 'Manage employee records, leaves and basic payroll.', userCount: 0, permissions: { employees: ['view', 'create', 'edit'], attendance: ['view', 'edit'], leaves: ['view', 'approve', 'reject'], payroll: ['view'] } },
    { id: '3', name: 'Employee', description: 'Standard access for personal self-service.', userCount: 0, permissions: { employees: ['view'], attendance: ['view'], leaves: ['view', 'apply'] } },
  ]);

  const [shiftFormData, setShiftFormData] = useState({
    name: '', shift_start_time: '10:00', shift_end_time: '19:00', total_working_hours: 9, grace_minutes: 15, late_start_time: '10:16', late_end_time: '10:59', overlate_start_time: '11:00', halfday_start_time: '12:30'
  });

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '', permissions: {} });

  const handleOpenModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFormData({
        moduleName: field.module_name || 'Employees',
        fieldName: field.field_name,
        fieldType: field.field_type,
        isRequired: field.is_required,
        options: typeof field.options === 'string' ? field.options : JSON.stringify(field.options)
      });
    } else {
      setEditingField(null);
      setFormData({ moduleName: 'Employees', fieldName: '', fieldType: 'text', isRequired: false, options: '' });
    }
    setShowModal(true);
  };

  const handleSaveField = async (e) => {
    e.preventDefault();
    try {
      if (editingField) {
        const idToUpdate = editingField.db_id || editingField.id;
        await api.put(`/custom-fields/${idToUpdate}`, formData);
      } else {
        await api.post('/custom-fields', formData);
      }
      
      const response = await api.get('/custom-fields?module=employees');
      setCustomFields(response.data);
      setShowModal(false);
    } catch (err) {
      console.error('Error saving custom field:', err);
      alert('Failed to save custom field');
    }
  };

  const handleDeleteField = async (db_id) => {
    if (window.confirm('Are you sure you want to delete this custom field?')) {
      try {
        await api.delete(`/custom-fields/${db_id}`);
        const response = await api.get('/custom-fields?module=employees');
        setCustomFields(response.data);
      } catch (err) {
        console.error('Error deleting custom field:', err);
        alert('Failed to delete custom field');
      }
    }
  };

  const handleSaveRole = (e) => {
    e.preventDefault();
    if (editingRole) {
      setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...roleFormData, id: r.id } : r));
    } else {
      setRoles(prev => [...prev, { ...roleFormData, id: Date.now().toString(), userCount: 0 }]);
    }
    setShowRoleModal(false);
  };

  const togglePermission = (module, perm) => {
    setRoleFormData(prev => {
      const perms = { ...prev.permissions };
      if (!perms[module]) perms[module] = [];
      if (perms[module].includes(perm)) {
        perms[module] = perms[module].filter(p => p !== perm);
      } else {
        perms[module] = [...perms[module], perm];
      }
      return { ...prev, permissions: perms };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">System Settings</h2>
          <p className="text-slate-500 font-medium text-sm">Configure modules, custom fields, and permissions.</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 space-y-2 shrink-0">
          <button 
            onClick={() => setActiveTab('custom-fields')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'custom-fields' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Database size={18} />
            <span>Custom Fields</span>
          </button>
          <button 
            onClick={() => setActiveTab('modules')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'modules' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Layout size={18} />
            <span>Modules Configuration</span>
          </button>
          <button 
            onClick={() => setActiveTab('roles')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'roles' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Shield size={18} />
            <span>Roles & Permissions</span>
          </button>
          <button 
            onClick={() => setActiveTab('shifts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'shifts' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Clock size={18} />
            <span>Shift Management</span>
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {activeTab === 'custom-fields' && (
            <Card className="shadow-premium" noPadding>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Manage Custom Fields</h3>
                  <p className="text-sm text-slate-500">Dynamically add or modify fields for different modules.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2">
                  <Plus size={16} /> Add Field
                </Button>
              </div>
              
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50/50 uppercase text-xs font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-100">Module</th>
                      <th className="px-6 py-4 border-b border-slate-100">Field Name</th>
                      <th className="px-6 py-4 border-b border-slate-100">Type</th>
                      <th className="px-6 py-4 border-b border-slate-100">Required</th>
                      <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customFields.map((field) => (
                      <tr key={field.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 text-sm capitalize">{field.module_name}</td>
                        <td className="px-6 py-4 font-bold text-slate-900 text-sm">{field.field_name}</td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="bg-slate-100 uppercase text-[10px]">{field.field_type}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={field.is_required ? 'success' : 'default'}>{field.is_required ? 'Yes' : 'No'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleOpenModal(field)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteField(field.db_id || field.id)} className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customFields.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No custom fields found.</div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'modules' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {moduleMetadata.map((module) => {
                const isEnabled = enabledModules[module.id];
                return (
                  <Card key={module.id} className={`transition-all border-l-4 ${isEnabled ? 'border-primary-500 shadow-md' : 'border-slate-200 opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl ${isEnabled ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                          {<module.icon size={24} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{module.name}</h4>
                          <p className="text-sm text-slate-500 leading-tight mt-1">{module.description}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEnabledModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? 'bg-primary-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {activeTab === 'roles' && (
            <Card className="shadow-premium" noPadding>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Manage Roles & Permissions</h3>
                  <p className="text-sm text-slate-500">Define access levels for different user groups.</p>
                </div>
                <Button onClick={() => { setEditingRole(null); setRoleFormData({ name: '', description: '', permissions: {} }); setShowRoleModal(true); }} className="gap-2">
                  <Plus size={16} /> Add Role
                </Button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50/50 uppercase text-xs font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-100">Role Name</th>
                      <th className="px-6 py-4 border-b border-slate-100">Description</th>
                      <th className="px-6 py-4 border-b border-slate-100">Users</th>
                      <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roles.map((role) => (
                      <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">{role.name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-normal max-w-xs">
                          <p className="text-sm text-slate-500 leading-tight">{role.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-slate-700">{role.userCount}</span>
                            <span className="text-xs text-slate-400 font-medium tracking-wide">Users Assigned</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => { setEditingRole(role); setRoleFormData(role); setShowRoleModal(true); }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit Permissions">
                              <Edit size={16} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'shifts' && (
            <Card className="shadow-premium" noPadding>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Shift Configuration</h3>
                  <p className="text-sm text-slate-500">Customize shift timings, grace periods, and half-day thresholds.</p>
                </div>
                <Button onClick={() => { setEditingShift(null); setShiftFormData({ name: '', shift_start_time: '10:00', shift_end_time: '19:00', total_working_hours: 9, grace_minutes: 15, late_start_time: '10:16', late_end_time: '10:59', overlate_start_time: '11:00', halfday_start_time: '12:30' }); setShowShiftModal(true); }} className="gap-2">
                  <Plus size={16} /> Add Shift
                </Button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50/50 uppercase text-xs font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-100">Shift Name</th>
                      <th className="px-6 py-4 border-b border-slate-100">Timing</th>
                      <th className="px-6 py-4 border-b border-slate-100">Grace (Mins)</th>
                      <th className="px-6 py-4 border-b border-slate-100">Late Range</th>
                      <th className="px-6 py-4 border-b border-slate-100">Over Late</th>
                      <th className="px-6 py-4 border-b border-slate-100">Half Day</th>
                      <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">{shift.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <Clock size={14} className="text-primary-500" />
                            <span className="text-sm font-medium text-slate-700">{shift.shift_start_time} - {shift.shift_end_time} ({shift.total_working_hours}h)</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">{shift.grace_minutes} mins</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200">{shift.late_start_time} - {shift.late_end_time}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="bg-orange-100 text-orange-700 border-orange-200">{shift.overlate_start_time}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="bg-alert-100 text-alert-700 border-alert-200">{shift.halfday_start_time}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => { setEditingShift(shift); setShiftFormData(shift); setShowShiftModal(true); }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit Shift">
                              <Edit size={16} />
                            </button>
                            <button onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this shift?')) {
                                try {
                                  await api.delete(`/shifts/${shift.id}`);
                                  const response = await api.get('/shifts');
                                  setShifts(response.data);
                                } catch (err) {
                                  console.error('Error deleting shift:', err);
                                  alert('Failed to delete shift');
                                }
                              }
                            }} className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={editingField ? "Edit Custom Field" : "Create Custom Field"}
      >
        <form onSubmit={handleSaveField} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Target Module</label>
            <select 
              value={formData.moduleName}
              onChange={e => setFormData({...formData, moduleName: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800"
            >
              <option value="Employees">Employees</option>
              <option value="Attendance">Attendance</option>
              <option value="Leaves">Leaves</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Field Name</label>
            <Input 
              required
              placeholder="e.g. Passport Number"
              value={formData.fieldName}
              onChange={e => setFormData({...formData, fieldName: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Data Type</label>
              <select 
                value={formData.fieldType}
                onChange={e => setFormData({...formData, fieldType: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800"
              >
                <option value="text">Text (String)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Dropdown (Select)</option>
                <option value="boolean">Checkbox (Yes/No)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Required Field?</label>
              <div className="flex items-center space-x-4 mt-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="req" checked={formData.isRequired} onChange={() => setFormData({...formData, isRequired: true})} className="text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-medium">Yes</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="req" checked={!formData.isRequired} onChange={() => setFormData({...formData, isRequired: false})} className="text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-medium">No</span>
                </label>
              </div>
            </div>
          </div>
          
          {formData.fieldType === 'dropdown' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Dropdown Options (Comma separated)</label>
              <Input 
                placeholder="Option 1, Option 2, Option 3"
                value={formData.options}
                onChange={e => setFormData({...formData, options: e.target.value})}
              />
            </motion.div>
          )}

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">{editingField ? 'Update Field' : 'Save Field'}</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={showShiftModal} 
        onClose={() => setShowShiftModal(false)}
        title={editingShift ? "Edit Shift Configuration" : "Add New Shift"}
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (editingShift) {
              await api.put(`/shifts/${editingShift.id}`, shiftFormData);
            } else {
              await api.post('/shifts', shiftFormData);
            }
            // Refresh shifts from server
            const response = await api.get('/shifts');
            setShifts(response.data);
            setShowShiftModal(false);
          } catch (err) {
            console.error('Error saving shift:', err);
            alert('Failed to save shift configuration');
          }
        }} className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Shift Name</label>
              <Input 
                required
                placeholder="e.g. Regular Shift"
                value={shiftFormData.name}
                onChange={e => setShiftFormData({...shiftFormData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Total Working Hours</label>
              <Input 
                type="number" step="0.5" required
                value={shiftFormData.total_working_hours}
                onChange={e => setShiftFormData({...shiftFormData, total_working_hours: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Grace Period (mins)</label>
              <Input 
                type="number" required
                value={shiftFormData.grace_minutes}
                onChange={e => setShiftFormData({...shiftFormData, grace_minutes: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block text-primary-600">Shift Start Time</label>
              <Input 
                type="time" required
                value={shiftFormData.shift_start_time}
                onChange={e => setShiftFormData({...shiftFormData, shift_start_time: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block text-primary-600">Shift End Time</label>
              <Input 
                type="time" required
                value={shiftFormData.shift_end_time}
                onChange={e => setShiftFormData({...shiftFormData, shift_end_time: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 bg-amber-50/30 p-4 -mx-4">
            <div>
              <label className="text-xs font-bold text-amber-900 tracking-wide uppercase mb-1.5 block">Late Range Start</label>
              <Input 
                type="time" required
                value={shiftFormData.late_start_time}
                onChange={e => setShiftFormData({...shiftFormData, late_start_time: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-900 tracking-wide uppercase mb-1.5 block">Late Range End</label>
              <Input 
                type="time" required
                value={shiftFormData.late_end_time}
                onChange={e => setShiftFormData({...shiftFormData, late_end_time: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 bg-orange-50/30 p-4 -mx-4 rounded-b-xl">
            <div>
              <label className="text-xs font-bold text-orange-900 tracking-wide uppercase mb-1.5 block">Over-Late Start From</label>
              <Input 
                type="time" required
                value={shiftFormData.overlate_start_time}
                onChange={e => setShiftFormData({...shiftFormData, overlate_start_time: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-alert-900 tracking-wide uppercase mb-1.5 block">Half-Day Start From</label>
              <Input 
                type="time" required
                value={shiftFormData.halfday_start_time}
                onChange={e => setShiftFormData({...shiftFormData, halfday_start_time: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowShiftModal(false)}>Cancel</Button>
            <Button type="submit">{editingShift ? 'Update Shift' : 'Save Shift'}</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={showRoleModal} 
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? "Edit Role Permissions" : "Create New Role"}
      >
        <form onSubmit={handleSaveRole} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Role Name</label>
              <Input 
                required
                placeholder="e.g. Finance Manager"
                value={roleFormData.name}
                onChange={e => setRoleFormData({...roleFormData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Description</label>
              <textarea 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800 resize-none h-20"
                placeholder="Briefly describe what this role can do..."
                value={roleFormData.description}
                onChange={e => setRoleFormData({...roleFormData, description: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Module Permissions</label>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {['employees', 'attendance', 'leaves', 'payroll'].map((module) => (
                <div key={module} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-bold text-slate-900 capitalize">{module}</h5>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {['view', 'create', 'edit', 'delete', 'approve'].map((perm) => (
                      <label key={perm} className="flex items-center space-x-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={roleFormData.permissions[module]?.includes(perm) || false}
                          onChange={() => togglePermission(module, perm)}
                          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-xs font-medium text-slate-600 capitalize">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowRoleModal(false)}>Cancel</Button>
            <Button type="submit">{editingRole ? 'Update Role' : 'Create Role'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default Settings;
