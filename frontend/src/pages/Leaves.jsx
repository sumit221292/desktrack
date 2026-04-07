import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, Search, RefreshCw, Settings } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

const statusBadge = (s) => {
  const map = {
    PENDING: { tw: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
    APPROVED: { tw: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Approved' },
    REJECTED: { tw: 'bg-red-50 text-red-700 border-red-200', label: 'Rejected' },
  };
  const c = map[(s || '').toUpperCase()] || map.PENDING;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.tw}`}>{c.label}</span>;
};

const Leaves = () => {
  const { user } = useAuth();
  const isHR = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [showApply, setShowApply] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [applyForm, setApplyForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [typeForm, setTypeForm] = useState({ name: '', code: '', annual_quota: 12, carry_forward: false });
  const [editingType, setEditingType] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, reqRes, balRes] = await Promise.all([
        api.get('/leaves/types'),
        api.get('/leaves/requests'),
        api.get(`/leaves/balances?year=${currentYear}`)
      ]);
      setLeaveTypes(typesRes.data || []);
      setRequests(reqRes.data || []);
      setBalances(balRes.data || []);
    } catch (err) {
      console.error('Fetch leaves error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const pending = requests.filter(r => r.status === 'PENDING').length;
  const approved = requests.filter(r => r.status === 'APPROVED').length;
  const rejected = requests.filter(r => r.status === 'REJECTED').length;

  const filtered = requests.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (search && !(r.employee_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/leaves/apply', applyForm);
      setShowApply(false);
      setApplyForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply leave');
    }
    setSubmitting(false);
  };

  const handleReview = async (id, status) => {
    try {
      await api.put(`/leaves/requests/${id}/review`, { status });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleInitBalances = async () => {
    try {
      const res = await api.post('/leaves/balances/init', { year: currentYear });
      setBalances(res.data || []);
    } catch (err) { alert('Failed to initialize balances'); }
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.put(`/leaves/types/${editingType.id}`, typeForm);
      } else {
        await api.post('/leaves/types', typeForm);
      }
      setShowTypeModal(false);
      setEditingType(null);
      setTypeForm({ name: '', code: '', annual_quota: 12, carry_forward: false });
      await fetchData();
    } catch (err) { alert('Failed to save leave type'); }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Delete this leave type?')) return;
    try { await api.delete(`/leaves/types/${id}`); await fetchData(); } catch { alert('Failed'); }
  };

  const calcDays = (start, end) => {
    if (!start || !end) return 0;
    let days = 0;
    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    return days || 1;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
        <Card className="p-12 text-center"><div className="animate-pulse flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-full bg-slate-200" /><div className="h-4 w-48 bg-slate-200 rounded" /></div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage leave requests, balances, and policies</p>
        </div>
        <div className="flex items-center gap-3">
          {isHR && (
            <>
              <Button variant="secondary" onClick={handleInitBalances} className="gap-2 text-xs"><RefreshCw size={14} /> Init Balances</Button>
              <Button variant="secondary" onClick={() => { setEditingType(null); setTypeForm({ name: '', code: '', annual_quota: 12, carry_forward: false }); setShowTypeModal(true); }} className="gap-2 text-xs"><Settings size={14} /> Manage Types</Button>
            </>
          )}
          <Button onClick={() => setShowApply(true)} className="gap-2"><Plus size={16} /> Apply Leave</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: pending, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Approved', value: approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { label: 'Rejected', value: rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
          { label: 'Total', value: requests.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100' },
        ].map(s => (
          <Card key={s.label} className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg}`}><s.icon size={22} className={s.color} /></div>
            <div><p className="text-2xl font-bold text-slate-900">{s.value}</p><p className="text-xs text-slate-500 font-medium">{s.label}</p></div>
          </Card>
        ))}
      </div>

      {/* Balances */}
      {balances.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 px-2">Leave Balances — {currentYear}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left border-b">Employee</th>
                  {leaveTypes.map(lt => <th key={lt.id} className="px-4 py-3 text-center border-b" title={lt.name}>{lt.code}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...new Set(balances.map(b => b.employee_id))].map(empId => {
                  const empBals = balances.filter(b => b.employee_id === empId);
                  const empName = empBals[0]?.employee_name || requests.find(r => r.employee_id === empId)?.employee_name || `Emp #${empId}`;
                  return (
                    <tr key={empId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{empName}</td>
                      {leaveTypes.map(lt => {
                        const bal = empBals.find(b => b.leave_type_id === lt.id);
                        return (
                          <td key={lt.id} className="px-4 py-3 text-center">
                            {bal ? <span className="text-xs"><span className="font-bold text-emerald-700">{bal.remaining}</span><span className="text-slate-400">/{bal.total}</span></span> : <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Requests Table */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Leave Requests</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-medium bg-white">
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Calendar size={40} className="mx-auto mb-3 text-slate-300" /><p className="font-medium">No leave requests found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left border-b">Employee</th>
                  <th className="px-5 py-3 text-left border-b">Leave Type</th>
                  <th className="px-5 py-3 text-left border-b">Duration</th>
                  <th className="px-5 py-3 text-center border-b">Days</th>
                  <th className="px-5 py-3 text-left border-b">Reason</th>
                  <th className="px-5 py-3 text-center border-b">Status</th>
                  {isHR && <th className="px-5 py-3 text-center border-b">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{r.employee_name || 'Unknown'}</td>
                    <td className="px-5 py-3"><Badge variant="default" className="text-xs">{r.leave_type_name || r.leave_type_code || '-'}</Badge></td>
                    <td className="px-5 py-3 text-slate-600">
                      {r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                      {r.start_date !== r.end_date && <> → {r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</>}
                    </td>
                    <td className="px-5 py-3 text-center font-bold">{r.days}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate" title={r.reason}>{r.reason || '-'}</td>
                    <td className="px-5 py-3 text-center">{statusBadge(r.status)}</td>
                    {isHR && (
                      <td className="px-5 py-3 text-center">
                        {r.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleReview(r.id, 'APPROVED')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Approve"><CheckCircle size={18} /></button>
                            <button onClick={() => handleReview(r.id, 'REJECTED')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Reject"><XCircle size={18} /></button>
                          </div>
                        ) : <span className="text-xs text-slate-400">Reviewed</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Apply Leave Modal */}
      <Modal isOpen={showApply} onClose={() => setShowApply(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">Leave Type *</label>
            <select value={applyForm.leave_type_id} onChange={e => setApplyForm({ ...applyForm, leave_type_id: e.target.value })} required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
              <option value="">Select leave type...</option>
              {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">Start Date *</label>
              <Input type="date" required value={applyForm.start_date} onChange={e => setApplyForm({ ...applyForm, start_date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">End Date *</label>
              <Input type="date" required value={applyForm.end_date} onChange={e => setApplyForm({ ...applyForm, end_date: e.target.value })} />
            </div>
          </div>
          {applyForm.start_date && applyForm.end_date && (
            <div className="bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold text-blue-700">{calcDays(applyForm.start_date, applyForm.end_date)} working day(s)</div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">Reason</label>
            <textarea value={applyForm.reason} onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })} rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary-500/20" placeholder="Enter reason..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </form>
      </Modal>

      {/* Manage Leave Types Modal */}
      <Modal isOpen={showTypeModal} onClose={() => { setShowTypeModal(false); setEditingType(null); }} title="Manage Leave Types" maxWidth="max-w-2xl">
        <div className="space-y-6">
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {leaveTypes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No leave types configured.</div>
            ) : leaveTypes.map(lt => (
              <div key={lt.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-xs font-bold">{lt.code}</Badge>
                  <span className="font-medium text-slate-800 text-sm">{lt.name}</span>
                  <span className="text-xs text-slate-400">{lt.annual_quota} days/year</span>
                  {lt.carry_forward && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">Carry Forward</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingType(lt); setTypeForm({ name: lt.name, code: lt.code, annual_quota: lt.annual_quota, carry_forward: lt.carry_forward }); }} className="text-xs text-primary-600 hover:underline font-bold px-2 py-1">Edit</button>
                  <button onClick={() => handleDeleteType(lt.id)} className="text-xs text-red-500 hover:underline font-bold px-2 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSaveType} className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase">{editingType ? 'Edit Type' : 'Add New Type'}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-bold text-slate-700 mb-1 block">Name *</label><Input required value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Sick Leave" /></div>
              <div><label className="text-xs font-bold text-slate-700 mb-1 block">Code *</label><Input required value={typeForm.code} onChange={e => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })} placeholder="e.g. SL" maxLength={5} /></div>
              <div><label className="text-xs font-bold text-slate-700 mb-1 block">Annual Quota</label><Input type="number" min="0" value={typeForm.annual_quota} onChange={e => setTypeForm({ ...typeForm, annual_quota: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={typeForm.carry_forward} onChange={e => setTypeForm({ ...typeForm, carry_forward: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-primary-600" /><span className="text-sm font-medium text-slate-700">Carry Forward</span></label></div>
            </div>
            <div className="flex justify-end gap-3">
              {editingType && <Button variant="ghost" type="button" onClick={() => { setEditingType(null); setTypeForm({ name: '', code: '', annual_quota: 12, carry_forward: false }); }}>Cancel Edit</Button>}
              <Button type="submit">{editingType ? 'Update Type' : 'Add Type'}</Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default Leaves;
