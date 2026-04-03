import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, Filter, Search, Download, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

// Live ticking timer for checked-in employees
const LiveTimer = ({ checkInTime, breakMins = 0 }) => {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!checkInTime || checkInTime === '-') return;
    const start = new Date(checkInTime).getTime();
    const breakMs = (breakMins || 0) * 60000;
    const tick = () => {
      const diff = Math.max(0, Date.now() - start - breakMs);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkInTime, breakMins]);
  return <span className="text-emerald-600 font-mono tabular-nums">{elapsed}</span>;
};

// Live break timer: ticks from checkout until expected out
const LiveBreakTimer = ({ checkOutTime, baseMins = 0, expectedOut }) => {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!checkOutTime || checkOutTime === '-') return;
    const coTime = new Date(checkOutTime).getTime();
    const expTime = expectedOut ? new Date(expectedOut).getTime() : null;
    const baseMs = (baseMins || 0) * 60000;
    const tick = () => {
      const now = Date.now();
      // Stop ticking if expected out time has passed
      if (expTime && now >= expTime) {
        const diff = baseMs + Math.max(0, expTime - coTime);
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
        return;
      }
      const diff = baseMs + Math.max(0, now - coTime);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    // Stop interval if already past expected out
    if (expTime && Date.now() >= expTime) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkOutTime, baseMins, expectedOut]);
  return <span className="text-orange-600 font-mono tabular-nums">{elapsed}</span>;
};

const getStatusBadge = (status, reason = '') => {
  const s = (status || '').toUpperCase().trim();
  switch(s) {
    case 'ON TIME': case 'PRESENT': case 'COMPLETE': return <Badge variant="success" title={reason}>On Time (P)</Badge>;
    case 'LATE': case 'LATE_ARRIVAL': return <Badge variant="warning" title={reason}>Late (LT)</Badge>;
    case 'OVER LATE': case 'OVERLATE': return <Badge variant="danger" className="bg-orange-500 text-white border-none" title={reason}>Over Late (OL)</Badge>;
    case 'ABSENT': return <Badge variant="danger" title={reason}>Absent (A)</Badge>;
    case 'HALF DAY': case 'HALFDAY': return <Badge variant="primary" className="bg-rose-600 text-white border-none" title={reason}>Half Day (HD)</Badge>;
    case 'INCOMPLETE': return <Badge variant="warning" className="bg-blue-500 text-white border-none" title={reason}>Active</Badge>;
    case 'LEAVE': return <Badge variant="danger" className="bg-slate-500 text-white border-none" title={reason}>Leave (L)</Badge>;
    case 'OFFICE HOLIDAY': return <Badge variant="warning" className="bg-amber-500 text-white border-none" title={reason}>Office Holiday (OH)</Badge>;
    case 'PUBLIC HOLIDAY': return <Badge variant="warning" className="bg-amber-400 text-white border-none" title={reason}>Public Holiday (H)</Badge>;
    default: return <Badge title={reason}>{status}</Badge>;
  }
};

const Attendance = () => {
  const { isCheckedIn, toggleCheckIn, selectedDate, setSelectedDate, shifts } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '', remarks: '' });
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const minsToHMS = (totalMins) => {
    if (!totalMins || totalMins <= 0) return '00:00:00';
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    const s = Math.round((totalMins % 1) * 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const formatTime = (timeStr, offsetMins = 0) => {
    if (!timeStr) return '-';
    let [h, m] = timeStr.split(':').map(Number);
    m += offsetMins;
    while(m >= 60) { h++; m -= 60; }
    while(m < 0) { h--; m += 60; }
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const getDuration = (startStr, endStr, offsetStartMins = 0) => {
    if (!startStr || !endStr || startStr === '-' || endStr === '-') return '0h 00m';
    const parseTime = (t) => {
      const parts = t.trim().split(' ');
      if (parts.length < 2) return 0;
      const [timePart, modifier] = parts;
      let [h, m] = timePart.split(':').map(Number);
      if (modifier === 'PM' && h < 12) h += 12;
      if (modifier === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    try {
      const startMins = parseTime(startStr);
      const endMins = parseTime(endStr);
      let totalMins = endMins - (startMins + offsetStartMins);
      if (totalMins < 0) totalMins = 0;
      return `${Math.floor(totalMins / 60)}h ${String(totalMins % 60).padStart(2, '0')}m`;
    } catch (err) { return '0h 00m'; }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/attendance?date=${selectedDate}`);
      const data = response.data;
      const mapped = data.map(r => {
        const outTime = r.last_check_out || r.check_out;
        return {
          ...r,
          checkIn: r.check_in && r.check_in !== '-' ? new Date(r.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-',
          checkOut: outTime && outTime !== '-' ? new Date(outTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : (r.is_checked_in ? 'Active' : '-'),
          expectedCheckout: r.expectedCheckout || '-',
          displayName: r.name,
          displayStatus: r.displayStatus || (r.status || '').replace('_', ' ')
        };
      });
      setRecords(mapped);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAttendance();
  }, [selectedDate, isCheckedIn, shifts]);

  const handleUpdate = async () => {
    try {
      const parseDisplayTime = (dt, timeVal) => {
        if (!timeVal || timeVal === '-' || timeVal === 'Active') return null;
        // timeVal is "HH:MM" from time input
        const [h, m] = timeVal.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return `${dt}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+05:30`;
      };

      const payload = {
        check_in: parseDisplayTime(selectedDate, editForm.checkIn),
        check_out: parseDisplayTime(selectedDate, editForm.checkOut),
        remarks: editForm.remarks
      };

      await api.put(`/attendance/${activeRecord.id}`, payload);

      setIsEditModalOpen(false);
      setIsRemarksModalOpen(false);
      fetchAttendance();
    } catch (err) {
      console.error('Update failed:', err);
      alert(err.response?.data?.error || 'Failed to update attendance');
    }
  };

  const attendanceData = records.filter(record => {
    const nameStr = record.name || record.displayName || '';
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || record.status === filterStatus || record.displayStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const openEdit = (record) => {
    setActiveRecord(record);
    // Convert display time "12:35 pm" to 24h input value "12:35" for time input
    const to24h = (displayTime) => {
      if (!displayTime || displayTime === '-' || displayTime === 'Active') return '';
      const [time, mod] = displayTime.split(' ');
      if (!time) return '';
      let [h, m] = time.split(':').map(Number);
      if (mod?.toUpperCase() === 'PM' && h < 12) h += 12;
      if (mod?.toUpperCase() === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    };
    setEditForm({
      checkIn: to24h(record.checkIn),
      checkOut: to24h(record.checkOut),
      remarks: record.remarks || ''
    });
    setIsEditModalOpen(true);
  };

  const openRemarks = (record) => {
    setActiveRecord(record);
    setEditForm({ ...editForm, remarks: record.remarks || '' });
    setIsRemarksModalOpen(true);
  };

  const presentCount = records.filter(r => r.status !== 'Absent' && r.checkIn !== '-').length;

  return (
    <div className="space-y-6 animate-fade-in pb-12 relative">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">Daily Attendance</h2>
          <p className="text-slate-500 font-medium text-sm">Monitor employee check-ins and working hours.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative group flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all cursor-pointer">
            <CalendarIcon size={16} className="text-primary-500 mr-2" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 outline-none text-slate-700 cursor-pointer text-sm"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <Button 
            variant={isCheckedIn ? "danger" : "primary"} 
            className="gap-2 shadow-lg h-[42px]"
            onClick={toggleCheckIn}
          >
            <Clock size={18} />
            {isCheckedIn ? 'Check Out Now' : 'Check In Now'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-primary-50/50 border-primary-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-primary-700 uppercase tracking-wider mb-1">Total Present</p>
            <p className="text-3xl font-bold text-slate-900 font-display">{presentCount} / {records.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
             <Clock size={24} />
          </div>
        </Card>
      </div>

      <Card noPadding className="shadow-premium">
        {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center font-bold text-primary-600">Updating...</div>}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <div className="w-full sm:max-w-md">
            <Input 
              icon={Search} 
              placeholder="Search records by employee name..." 
              className="bg-slate-50 border-slate-200" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none bg-secondary-50 border border-secondary-200 text-secondary-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full pl-3 pr-10 py-2 transition-all cursor-pointer font-medium"
              >
                <option value="All">All Status</option>
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-secondary-500">
                <Filter size={16} />
              </div>
            </div>
            <Button variant="secondary" className="gap-2 w-full sm:w-auto text-primary-600 border-primary-200 bg-primary-50">
               <Download size={16} />
            </Button>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50/90 backdrop-blur-sm sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <tr>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Employee</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Timings</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Expected Out</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Late By</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Work Hours</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">Productivity</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200 text-center">Status</th>
                <th className="px-5 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendanceData.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-5 py-3">
                    <p className="font-bold text-slate-900 text-sm leading-none">{record.name}</p>
                    <div className="flex items-center mt-1.5 space-x-2">
                       {record.late_count > 0 && <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Late ({record.late_count}/3)</span>}
                       {record.overlate_count > 0 && <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">O-Late ({record.overlate_count}/2)</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-sm font-bold text-slate-800"><span className="w-8 text-slate-400 text-[10px] font-bold uppercase tracking-wide">IN:</span>{record.checkIn}</div>
                      <div className="flex items-center text-sm font-bold text-slate-800"><span className="w-8 text-slate-400 text-[10px] font-bold uppercase tracking-wide">OUT:</span>{record.checkOut}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold text-primary-700 text-sm">{record.expectedCheckout && record.expectedCheckout !== '-' ? new Date(record.expectedCheckout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-'}</td>
                  <td className="px-5 py-3">
                    {record.lateMinutes > 0 ? (
                      <span className="text-orange-600 font-bold text-sm bg-orange-50 px-2.5 py-1 rounded-md">{`${String(Math.floor(record.lateMinutes / 60)).padStart(2,'0')}h ${String(record.lateMinutes % 60).padStart(2,'0')}m`}</span>
                    ) : (
                      <span className="text-slate-400 font-bold text-sm">00h 00m</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-bold text-slate-900 text-sm">
                      {record.is_checked_in
                        ? <LiveTimer checkInTime={record.check_in} breakMins={record.total_break_minutes} />
                        : minsToHMS(record.net_work_minutes)}
                    </div>
                    {record.is_checked_in ? (
                      <div className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px] font-bold mt-1 inline-block animate-pulse">● Working</div>
                    ) : record.shortfallMinutes > 0 ? (
                      <div className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px] font-bold mt-1 inline-block">-{minsToHMS(record.shortfallMinutes)} Shortfall</div>
                    ) : record.checkIn !== '-' ? (
                      <div className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-bold mt-1 inline-block">✓ Completed</div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                     <div className="flex flex-col gap-1.5 text-[11px] font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-[18px] h-[18px] rounded bg-emerald-100 flex items-center justify-center text-emerald-600 text-[9px] shrink-0">W</span>
                          <span className="text-slate-500 w-10">Work</span>
                          <span className="text-emerald-700">{record.is_checked_in ? <LiveTimer checkInTime={record.check_in} breakMins={record.total_break_minutes} /> : minsToHMS(record.net_work_minutes)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-[18px] h-[18px] rounded bg-blue-100 flex items-center justify-center text-blue-600 text-[9px] shrink-0">B</span>
                          <span className="text-slate-500 w-10">Break</span>
                          <span className="text-blue-700">{
                            // Live break timer: ticks after checkout until expected out
                            !record.is_checked_in && record.check_out && record.check_out !== '-' && record.expectedCheckout && record.expectedCheckout !== '-' && new Date(record.check_out) < new Date(record.expectedCheckout)
                              ? <LiveBreakTimer checkOutTime={record.check_out} baseMins={record.total_break_minutes} expectedOut={record.expectedCheckout} />
                              : minsToHMS(record.total_break_minutes)
                          }</span>
                        </div>
                     </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {getStatusBadge(record.displayStatus || record.status, record.reason)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" onClick={() => openEdit(record)} className="text-primary-600 font-bold text-xs px-2 py-1 h-auto hover:bg-primary-50 shrink-0">Edit</Button>
                      <div className="flex flex-col items-start gap-1 min-w-0">
                        <Button variant="ghost" onClick={() => openRemarks(record)} className="text-slate-500 font-bold text-xs px-2 py-1 h-auto hover:bg-slate-100">Remarks</Button>
                        {record.remarks && (
                          <p className="text-xs text-slate-500 italic bg-amber-50 px-2 py-1 rounded-md border border-amber-100 whitespace-normal break-words">
                            {record.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Attendance Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Attendance</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Overriding attendance for <span className="text-primary-600">{activeRecord?.name}</span></p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check In</label>
                  <input type="time"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm({...editForm, checkIn: e.target.value})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check Out</label>
                  <input type="time"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm({...editForm, checkOut: e.target.value})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Admin Remarks</label>
                <textarea 
                  className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-medium"
                  placeholder="Reason for manual adjustment..."
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({...editForm, remarks: e.target.value})}
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end space-x-3">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate}>Save Changes</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Remarks Modal */}
      {isRemarksModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Attendance Remarks</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Add notes for <span className="text-primary-600">{activeRecord?.name}</span></p>
            
            <textarea 
              className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-medium"
              placeholder="Type your remarks here..."
              value={editForm.remarks}
              onChange={(e) => setEditForm({...editForm, remarks: e.target.value})}
            />

            <div className="mt-8 flex items-center justify-end space-x-3">
              <Button variant="secondary" onClick={() => setIsRemarksModalOpen(false)}>Close</Button>
              <Button onClick={handleUpdate}>Save Remarks</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Attendance;
