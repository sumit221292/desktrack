import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Shield, Layout, Database, Users, Clock, Calendar as CalendarIcon, TrendingUp, List, Check, X, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { motion } from 'framer-motion';

const Settings = () => {
  const { user, shifts, setShifts, enabledModules, setEnabledModules, hasPermission, rolePermissions, setRolePermissions, currencyConfig, setCurrencyConfig, deductionTypes, setDeductionTypes, companyTimezone, setCompanyTimezone } = useAuth();
  const navigate = useNavigate();

  if (!hasPermission('settings', 'view')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Shield size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 text-sm">You don't have permission to access System Settings.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('shifts');
  const [showModal, setShowModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editingShift, setEditingShift] = useState(null);

  const [newDeductionType, setNewDeductionType] = useState({ name: '', type: 'fixed', category: 'deduction', defaultValue: 0 });
  const saveDeductionTypes = (updated) => { setDeductionTypes(updated); };

  // Custom Fields Data
  const [customFields, setCustomFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Domains Data
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [loadingDomains, setLoadingDomains] = useState(false);

  // Role users popup
  const [allEmployees, setAllEmployees] = useState([]);
  const [showRoleUsers, setShowRoleUsers] = useState(null);

  // Manage Options Modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [managingField, setManagingField] = useState(null);
  const [optionsList, setOptionsList] = useState([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [editingOption, setEditingOption] = useState(null);
  const [editOptionName, setEditOptionName] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch role counts from employees
  useEffect(() => {
    const fetchRoleCounts = async () => {
      try {
        const res = await api.get('/employees');
        const employees = res.data || [];
        setAllEmployees(employees);
        setRoles(prev => prev.map(role => ({
          ...role,
          userCount: employees.filter(e => (e.role || '').toUpperCase() === role.roleKey).length
        })));
      } catch (err) {
        console.error('Error fetching role counts:', err);
      }
    };
    fetchRoleCounts();
  }, []);

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

  useEffect(() => {
    if (activeTab === 'authentication') {
      fetchDomains();
    }
  }, [activeTab]);

  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const response = await api.get('/settings/domains');
      setDomains(response.data);
    } catch (err) {
      console.error('Error fetching domains:', err);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    try {
      await api.post('/settings/domains', { domain: newDomain });
      setNewDomain('');
      fetchDomains();
    } catch (err) {
      console.error('Error adding domain:', err);
      alert(err.response?.data?.error || 'Failed to add domain');
    }
  };

  const handleDeleteDomain = async (id) => {
    if (window.confirm('Are you sure you want to remove this domain?')) {
      try {
        await api.delete(`/settings/domains/${id}`);
        fetchDomains();
      } catch (err) {
        console.error('Error deleting domain:', err);
        alert('Failed to remove domain');
      }
    }
  };

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

  // Roles with live user counts
  const [roles, setRoles] = useState([
    { id: '1', name: 'Super Admin', roleKey: 'SUPER_ADMIN', description: 'Full access to all modules and system settings.', userCount: 0, permissions: { employees: ['view', 'create', 'edit', 'delete'], attendance: ['view', 'create', 'edit', 'delete'], leaves: ['view', 'approve', 'reject'], payroll: ['view', 'edit', 'approve'] } },
    { id: '2', name: 'HR Manager', roleKey: 'HR', description: 'Manage employee records, leaves and basic payroll.', userCount: 0, permissions: { employees: ['view', 'create', 'edit'], attendance: ['view', 'edit'], leaves: ['view', 'approve', 'reject'], payroll: ['view'] } },
    { id: '3', name: 'Manager', roleKey: 'MANAGER', description: 'Team oversight with read access to reports.', userCount: 0, permissions: { employees: ['view'], attendance: ['view', 'edit'], leaves: ['view', 'approve'] } },
    { id: '4', name: 'Employee', roleKey: 'EMPLOYEE', description: 'Standard access for personal self-service.', userCount: 0, permissions: { employees: ['view'], attendance: ['view'], leaves: ['view', 'apply'] } },
  ]);

  const [shiftFormData, setShiftFormData] = useState({
    name: '', shift_start_time: '10:00', shift_end_time: '19:00', total_working_hours: 9, grace_minutes: 15, late_start_time: '10:16', late_end_time: '10:59', overlate_start_time: '11:00', halfday_start_time: '12:30', lunch_allowed_minutes: 45, tea_allowed_minutes: 15, max_break_minutes: 70
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

  // --- Manage Dropdown Options ---
  const getOptionApiPath = (fieldId) => {
    if (fieldId === 'department_id') return '/employees/meta/departments';
    if (fieldId === 'designation_id') return '/employees/meta/designations';
    return null;
  };

  const openOptionsModal = async (field) => {
    setManagingField(field);
    setNewOptionName('');
    setEditingOption(null);
    setShowOptionsModal(true);
    setLoadingOptions(true);

    const apiPath = getOptionApiPath(field.field_id);
    if (apiPath) {
      try {
        const res = await api.get(apiPath);
        setOptionsList(res.data.map(d => ({ id: d.id, name: d.name })));
      } catch (err) {
        console.error('Error loading options:', err);
        setOptionsList([]);
      }
    } else if (field.field_id === 'role') {
      let opts = field.options || [];
      if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = []; } }
      setOptionsList(opts.map((o, i) => ({ id: i + 1, name: typeof o === 'object' ? o.label : o, value: typeof o === 'object' ? o.value : o })));
    } else {
      let opts = field.options || [];
      if (typeof opts === 'string') { opts = opts.split(',').map(s => s.trim()).filter(Boolean); }
      setOptionsList(opts.map((o, i) => ({ id: i + 1, name: typeof o === 'object' ? o.label : o })));
    }
    setLoadingOptions(false);
  };

  const handleAddOption = async () => {
    if (!newOptionName.trim()) return;
    const apiPath = getOptionApiPath(managingField.field_id);

    if (apiPath) {
      try {
        await api.post(apiPath, { name: newOptionName.trim() });
        const res = await api.get(apiPath);
        setOptionsList(res.data.map(d => ({ id: d.id, name: d.name })));
        setNewOptionName('');
        // Refresh custom fields so dropdown options are updated
        const cfRes = await api.get('/custom-fields?module=employees');
        setCustomFields(cfRes.data);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to add option');
      }
    } else if (managingField.field_id === 'role') {
      const updated = [...optionsList, { id: Date.now(), name: newOptionName.trim(), value: newOptionName.trim().toUpperCase().replace(/\s+/g, '_') }];
      setOptionsList(updated);
      setNewOptionName('');
      await saveRoleOptions(updated);
    }
  };

  const handleUpdateOption = async (opt) => {
    if (!editOptionName.trim()) return;
    const apiPath = getOptionApiPath(managingField.field_id);

    if (apiPath) {
      try {
        await api.put(`${apiPath}/${opt.id}`, { name: editOptionName.trim() });
        const res = await api.get(apiPath);
        setOptionsList(res.data.map(d => ({ id: d.id, name: d.name })));
        setEditingOption(null);
        const cfRes = await api.get('/custom-fields?module=employees');
        setCustomFields(cfRes.data);
      } catch (err) {
        alert('Failed to update option');
      }
    } else if (managingField.field_id === 'role') {
      const updated = optionsList.map(o => o.id === opt.id ? { ...o, name: editOptionName.trim(), value: editOptionName.trim().toUpperCase().replace(/\s+/g, '_') } : o);
      setOptionsList(updated);
      setEditingOption(null);
      await saveRoleOptions(updated);
    }
  };

  const handleDeleteOption = async (opt) => {
    if (!window.confirm(`Delete "${opt.name}"? Existing records using this option may be affected.`)) return;
    const apiPath = getOptionApiPath(managingField.field_id);

    if (apiPath) {
      try {
        await api.delete(`${apiPath}/${opt.id}`);
        const res = await api.get(apiPath);
        setOptionsList(res.data.map(d => ({ id: d.id, name: d.name })));
        const cfRes = await api.get('/custom-fields?module=employees');
        setCustomFields(cfRes.data);
      } catch (err) {
        alert('Failed to delete option');
      }
    } else if (managingField.field_id === 'role') {
      const updated = optionsList.filter(o => o.id !== opt.id);
      setOptionsList(updated);
      await saveRoleOptions(updated);
    }
  };

  const saveRoleOptions = async (opts) => {
    try {
      const jsonOpts = JSON.stringify(opts.map(o => ({ label: o.name, value: o.value || o.name.toUpperCase().replace(/\s+/g, '_') })));
      const fieldId = managingField.db_id || managingField.id;
      await api.put(`/custom-fields/${fieldId}`, {
        moduleName: managingField.module_name,
        fieldName: managingField.field_name,
        fieldType: managingField.field_type,
        isRequired: managingField.is_required,
        options: jsonOpts
      });
      const cfRes = await api.get('/custom-fields?module=employees');
      setCustomFields(cfRes.data);
    } catch (err) {
      console.error('Error saving role options:', err);
    }
  };

  const handleSaveRole = (e) => {
    e.preventDefault();
    let updatedRoles;
    if (editingRole) {
      updatedRoles = roles.map(r => r.id === editingRole.id ? { ...roleFormData, id: r.id, roleKey: r.roleKey, userCount: r.userCount } : r);
    } else {
      const newRoleKey = roleFormData.name.toUpperCase().replace(/\s+/g, '_');
      updatedRoles = [...roles, { ...roleFormData, id: Date.now().toString(), roleKey: newRoleKey, userCount: 0 }];
    }
    setRoles(updatedRoles);

    // Sync permissions to AuthContext — enforced app-wide
    const permMap = {};
    updatedRoles.forEach(r => {
      if (r.roleKey) permMap[r.roleKey] = r.permissions || {};
    });
    setRolePermissions(prev => ({ ...prev, ...permMap }));

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
          <button
            onClick={() => setActiveTab('payroll-settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'payroll-settings' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CreditCard size={18} />
            <span>Payroll Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('authentication')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'authentication' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Shield size={18} />
            <span>Authentication</span>
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
                      <th className="px-6 py-4 border-b border-slate-100">Options</th>
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
                          {field.field_type === 'dropdown' ? (
                            field.field_id === 'shift_id' ? (
                              <button onClick={() => setActiveTab('shifts')} className="text-xs font-bold text-primary-600 hover:underline">
                                Managed in Shifts tab
                              </button>
                            ) : (
                              <button
                                onClick={() => openOptionsModal(field)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors border border-primary-200"
                              >
                                <List size={13} />
                                {Array.isArray(field.options) ? field.options.length : '...'} Options
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={field.is_required ? 'success' : 'default'}>{field.is_required ? 'Yes' : 'No'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleOpenModal(field)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit Field">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteField(field.db_id || field.id)} className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors" title="Delete Field">
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
            <Card className="shadow-premium" noPadding onClick={(e) => { if (!e.target.closest('[data-role-popup]')) setShowRoleUsers(null); }}>
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
                        <td className="px-6 py-4" data-role-popup>
                          <button
                            onClick={() => setShowRoleUsers(showRoleUsers === role.roleKey ? null : role.roleKey)}
                            className="flex items-center space-x-2 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors -mx-1"
                          >
                            <span className="text-sm font-bold text-primary-700">{role.userCount}</span>
                            <span className="text-xs text-slate-400 font-medium tracking-wide">Users Assigned</span>
                          </button>
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

              {/* Timezone Selector */}
              <div className="px-6 pb-4 flex items-center gap-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-slate-400" />
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Timezone</label>
                </div>
                <select
                  value={companyTimezone}
                  onChange={e => setCompanyTimezone(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                  <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                  <option value="Asia/Dhaka">Asia/Dhaka (BST, UTC+6)</option>
                  <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET, UTC+1)</option>
                  <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                  <option value="America/Chicago">America/Chicago (CST, UTC-6)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST, UTC+10)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZST, UTC+12)</option>
                </select>
                <span className="text-xs text-slate-400">All shift times are in this timezone</span>
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
                      <th className="px-6 py-4 border-b border-slate-100">Breaks</th>
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
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 text-[11px] font-medium">
                            <span className="text-teal-700">Lunch: {shift.lunch_allowed_minutes || 45}m</span>
                            <span className="text-teal-700">Tea: {shift.tea_allowed_minutes || 15}m</span>
                            <span className="text-teal-600 font-bold">Max: {shift.max_break_minutes || 70}m</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => { setEditingShift(shift); setShiftFormData({ lunch_allowed_minutes: 45, tea_allowed_minutes: 15, max_break_minutes: 70, ...shift }); setShowShiftModal(true); }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit Shift">
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

          {activeTab === 'payroll-settings' && (
            <Card className="shadow-premium">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 font-display">Payroll Configuration</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Set default currency and payroll preferences.</p>
              </div>

              <div className="space-y-6">
                {/* Currency Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-2 block">Default Currency</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
                      { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
                      { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
                      { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
                      { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
                      { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
                    ].map(cur => (
                      <button
                        key={cur.code}
                        onClick={() => setCurrencyConfig(cur)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          currencyConfig.code === cur.code
                            ? 'border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-2xl font-bold ${currencyConfig.code === cur.code ? 'text-primary-700' : 'text-slate-400'}`}>
                          {cur.symbol}
                        </span>
                        <div className="text-left">
                          <p className={`text-sm font-bold ${currencyConfig.code === cur.code ? 'text-primary-700' : 'text-slate-700'}`}>{cur.code}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{cur.name}</p>
                        </div>
                        {currencyConfig.code === cur.code && (
                          <Check size={16} className="text-primary-600 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deduction Types */}
                <div>
                  <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-2 block">Salary Slip Fields</label>
                  <p className="text-xs text-slate-400 mb-3">Define custom earning & deduction fields that appear on every employee's salary slip and structure.</p>

                  {/* Add new */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Field name (e.g. Bonus, Advance Recovery)"
                      value={newDeductionType.name}
                      onChange={e => setNewDeductionType(p => ({ ...p, name: e.target.value }))}
                      className="flex-1 min-w-[180px] px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-primary-500/20"
                    />
                    {/* Category: Earning or Deduction */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
                      {[{key:'earning',label:'Earning',color:'text-green-700'},{key:'deduction',label:'Deduction',color:'text-red-700'}].map(c => (
                        <button key={c.key} type="button"
                          onClick={() => setNewDeductionType(p => ({ ...p, category: c.key }))}
                          className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${newDeductionType.category === c.key ? `bg-white ${c.color} shadow-sm` : 'text-slate-400 hover:text-slate-600'}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {/* Type: Fixed or Percent */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
                      {['fixed','percent'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setNewDeductionType(p => ({ ...p, type: t }))}
                          className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${newDeductionType.type === t ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                          {t === 'fixed' ? '₹ Fixed' : '% Percent'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number" min="0"
                      placeholder="Default value"
                      value={newDeductionType.defaultValue}
                      onChange={e => setNewDeductionType(p => ({ ...p, defaultValue: parseFloat(e.target.value) || 0 }))}
                      className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-primary-500/20 text-right"
                    />
                    <Button size="sm" type="button"
                      onClick={() => {
                        if (!newDeductionType.name.trim()) return;
                        saveDeductionTypes([...deductionTypes, { id: Date.now(), ...newDeductionType }]);
                        setNewDeductionType({ name: '', type: 'fixed', category: 'deduction', defaultValue: 0 });
                      }}
                      className="gap-1.5 shrink-0">
                      <Plus size={14}/> Add
                    </Button>
                  </div>

                  {/* List */}
                  {deductionTypes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No custom deduction types yet. Add one above — it will auto-appear in all salary structures.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {deductionTypes.map((dt, idx) => (
                        <div key={dt.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{dt.name}</p>
                            <p className="text-xs text-slate-400">{dt.type === 'fixed' ? `₹${dt.defaultValue} fixed` : `${dt.defaultValue}% of gross`}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${dt.category === 'earning' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {dt.category === 'earning' ? 'Earning' : 'Deduction'}
                          </span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${dt.type === 'fixed' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {dt.type === 'fixed' ? 'Fixed' : 'Percent'}
                          </span>
                          <button type="button"
                            onClick={() => saveDeductionTypes(deductionTypes.filter((_, i) => i !== idx))}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <X size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Salary Example</p>
                      <p className="text-2xl font-bold text-slate-900 font-display">
                        {new Intl.NumberFormat(currencyConfig.locale, { style: 'currency', currency: currencyConfig.code, minimumFractionDigits: 0 }).format(50000)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Bonus Example</p>
                      <p className="text-lg font-bold text-emerald-600">
                        +{new Intl.NumberFormat(currencyConfig.locale, { style: 'currency', currency: currencyConfig.code, minimumFractionDigits: 0 }).format(5000)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Deduction Example</p>
                      <p className="text-lg font-bold text-red-500">
                        -{new Intl.NumberFormat(currencyConfig.locale, { style: 'currency', currency: currencyConfig.code, minimumFractionDigits: 0 }).format(2500)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'authentication' && (
            <Card className="shadow-premium" noPadding>
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 font-display">Domain Approval</h3>
                <p className="text-sm text-slate-500">Manage corporate domains authorized to use Google OAuth.</p>
              </div>
              
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <form onSubmit={handleAddDomain} className="flex gap-3">
                  <div className="flex-1">
                    <Input 
                      placeholder="e.g. creativefrenzy.in"
                      value={newDomain}
                      onChange={e => setNewDomain(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="gap-2">
                    <Plus size={16} /> Authorize Domain
                  </Button>
                </form>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50/50 uppercase text-xs font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-100">Domain Name</th>
                      <th className="px-6 py-4 border-b border-slate-100">Status</th>
                      <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {domains.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{d.domain}</td>
                        <td className="px-6 py-4">
                          <Badge variant="success">Authorized</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteDomain(d.id); }}
                            className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors"
                            title="Remove Domain"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {domains.length === 0 && !loadingDomains && (
                  <div className="p-8 text-center text-slate-500 italic">No domains authorized yet. Click the button above to add your first domain.</div>
                )}
                {loadingDomains && (
                  <div className="p-8 text-center text-slate-400">Loading domains...</div>
                )}
              </div>

              <div className="p-6 bg-amber-50 rounded-b-xl border-t border-amber-100">
                <div className="flex gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg h-fit">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Security Note</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Whitelisting a domain allows anyone with a verified Google account on that domain to log into your DeskTrack instance. 
                      Only add domains that your organization fully controls.
                    </p>
                  </div>
                </div>
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

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 bg-orange-50/30 p-4 -mx-4">
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

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 bg-teal-50/30 p-4 -mx-4 rounded-b-xl">
            <div>
              <label className="text-xs font-bold text-teal-900 tracking-wide uppercase mb-1.5 block">Lunch Break (mins)</label>
              <Input
                type="number" min="0" required
                value={shiftFormData.lunch_allowed_minutes}
                onChange={e => setShiftFormData({...shiftFormData, lunch_allowed_minutes: parseInt(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-teal-900 tracking-wide uppercase mb-1.5 block">Tea Break (mins)</label>
              <Input
                type="number" min="0" required
                value={shiftFormData.tea_allowed_minutes}
                onChange={e => setShiftFormData({...shiftFormData, tea_allowed_minutes: parseInt(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-teal-900 tracking-wide uppercase mb-1.5 block">Max Total Break (mins)</label>
              <Input
                type="number" min="0" required
                value={shiftFormData.max_break_minutes}
                onChange={e => setShiftFormData({...shiftFormData, max_break_minutes: parseInt(e.target.value) || 0})}
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
        title={editingRole ? `Edit ${editingRole.name} Permissions` : "Create New Role"}
      >
        <form onSubmit={handleSaveRole} className="space-y-6">
          {/* Role identity — read-only for built-in roles */}
          {editingRole && ['1','2','3','4'].includes(editingRole.id) ? (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shrink-0">
                {editingRole.name[0]}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{editingRole.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{editingRole.description}</p>
              </div>
              <Badge variant="default" className="ml-auto shrink-0 bg-slate-200 text-slate-600">System Role</Badge>
            </div>
          ) : (
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
          )}

          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-1.5 block">Module Permissions</label>
            {editingRole?.roleKey === 'SUPER_ADMIN' && (
              <div className="flex items-center gap-2 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                <Shield size={16} className="text-primary-600 shrink-0" />
                <p className="text-xs font-medium text-primary-700">Super Admin always has full access to all modules. Permissions cannot be modified.</p>
              </div>
            )}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {['employees', 'attendance', 'leaves', 'payroll', 'reports', 'performance', 'settings'].map((module) => (
                <div key={module} className={`p-4 rounded-xl border ${editingRole?.roleKey === 'SUPER_ADMIN' ? 'bg-slate-100/50 border-slate-100 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-bold text-slate-900 capitalize">{module}</h5>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(module === 'settings' ? ['view', 'edit'] : ['view', 'create', 'edit', 'delete', 'approve']).map((perm) => (
                      <label key={perm} className={`flex items-center space-x-2 ${editingRole?.roleKey === 'SUPER_ADMIN' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={editingRole?.roleKey === 'SUPER_ADMIN' ? true : (roleFormData.permissions[module]?.includes(perm) || false)}
                          onChange={() => editingRole?.roleKey !== 'SUPER_ADMIN' && togglePermission(module, perm)}
                          disabled={editingRole?.roleKey === 'SUPER_ADMIN'}
                          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
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

      {/* Role Users Modal */}
      <Modal
        isOpen={!!showRoleUsers}
        onClose={() => setShowRoleUsers(null)}
        title={`${roles.find(r => r.roleKey === showRoleUsers)?.name || ''} Users`}
        maxWidth="max-w-md"
      >
        {showRoleUsers && (() => {
          const roleUsers = allEmployees.filter(e => (e.role || '').toUpperCase() === showRoleUsers);
          return roleUsers.length === 0 ? (
            <div className="py-8 text-center">
              <Users size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No users assigned to this role.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roleUsers.map(emp => (
                <div
                  key={emp.id}
                  onClick={() => { setShowRoleUsers(null); navigate(`/employees/${emp.id}`); }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer group border border-transparent hover:border-primary-200"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-primary-200 transition-colors">
                    {(emp.first_name || '?')[0]}{(emp.last_name || '?')[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-primary-700 transition-colors">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                  </div>
                  <Badge variant={emp.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'default'} className="shrink-0">
                    {emp.status || 'Active'}
                  </Badge>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      {/* Manage Dropdown Options Modal */}
      <Modal
        isOpen={showOptionsModal}
        onClose={() => { setShowOptionsModal(false); setManagingField(null); setEditingOption(null); }}
        title={`Manage ${managingField?.field_name || 'Dropdown'} Options`}
        maxWidth="max-w-lg"
      >
        {managingField && (
          <div className="space-y-6">
            {/* Add New Option */}
            <form onSubmit={(e) => { e.preventDefault(); handleAddOption(); }} className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder={`Add new ${managingField.field_name?.toLowerCase() || 'option'}...`}
                  value={newOptionName}
                  onChange={e => setNewOptionName(e.target.value)}
                />
              </div>
              <Button type="submit" className="gap-2 shrink-0">
                <Plus size={16} /> Add
              </Button>
            </form>

            {/* Options List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {optionsList.length} Option{optionsList.length !== 1 ? 's' : ''} Configured
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto custom-scrollbar">
                {loadingOptions ? (
                  <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : optionsList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No options yet. Add one above.</div>
                ) : optionsList.map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    {editingOption?.id === opt.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editOptionName}
                          onChange={e => setEditOptionName(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateOption(opt); } if (e.key === 'Escape') setEditingOption(null); }}
                        />
                        <button onClick={() => handleUpdateOption(opt)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingOption(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary-400"></div>
                          <span className="text-sm font-semibold text-slate-800">{opt.name}</span>
                          {opt.value && opt.value !== opt.name && (
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{opt.value}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingOption(opt); setEditOptionName(opt.name); }}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteOption(opt)}
                            className="p-1.5 text-slate-400 hover:text-alert-600 hover:bg-alert-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Settings;
