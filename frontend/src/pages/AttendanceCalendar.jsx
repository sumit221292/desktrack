import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Coffee, FileText, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS = {
  'PRESENT':   { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Present' },
  'LATE':      { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Late' },
  'OVER LATE': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Over Late' },
  'HALF DAY':  { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Half Day' },
  'ABSENT':    { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Absent' },
  'WEEKEND':   { bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300', label: 'Weekend' },
  '-':         { bg: 'bg-white', text: 'text-slate-300', dot: 'bg-slate-200', label: '-' },
};

const getStatusStyle = (status) => STATUS_COLORS[status] || STATUS_COLORS['-'];

const AttendanceCalendar = () => {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [detailPopup, setDetailPopup] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/monthly?month=${month}&year=${year}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch monthly attendance:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Attendance Calendar</h1>
        </div>
        <Card className="p-12 text-center">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200" />
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        </Card>
      </div>
    );
  }

  const employees = selectedEmployee === 'all'
    ? data.employees
    : data.employees.filter(e => String(e.id) === selectedEmployee);

  // Summary counts for the month per employee
  const getEmployeeSummary = (empId) => {
    const empRecords = data.records[empId] || {};
    const counts = { PRESENT: 0, LATE: 0, 'OVER LATE': 0, 'HALF DAY': 0, ABSENT: 0, WEEKEND: 0 };
    Object.values(empRecords).forEach(r => {
      if (r.status === 'PRESENT') counts.PRESENT++;
      else if (counts[r.status] !== undefined) counts[r.status]++;
    });
    return counts;
  };

  const formatTimeIST = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    } catch { return '-'; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly attendance overview per employee</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Employee Filter */}
          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <option value="all">All Employees</option>
            {data.employees.map(emp => (
              <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
            ))}
          </select>

          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-md transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <span className="px-3 py-2 font-bold text-slate-800 text-sm min-w-[160px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-md transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
          <button onClick={goToToday} className="px-3 py-2 text-sm font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors">Today</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== '-').map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-3 h-3 rounded-sm ${val.dot}`} />
            <span className="text-slate-600">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar per employee */}
      {employees.map(emp => {
        const summary = getEmployeeSummary(emp.id);
        const empRecords = data.records[emp.id] || {};

        return (
          <Card key={emp.id} className="overflow-hidden">
            {/* Employee Header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                  <User size={16} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                  <p className="text-[11px] text-slate-400">{emp.email}</p>
                </div>
              </div>
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">{summary.PRESENT + summary.LATE + summary['OVER LATE']}P</span>
                <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-700">{summary.LATE + summary['OVER LATE']}L</span>
                <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-700">{summary['HALF DAY']}HD</span>
                <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700">{summary.ABSENT}A</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Padding for first day */}
                {(() => {
                  const firstDow = new Date(year, month - 1, 1).getDay();
                  return Array.from({ length: firstDow }, (_, i) => (
                    <div key={`pad-${i}`} className="aspect-square" />
                  ));
                })()}

                {data.days.map(dateStr => {
                  const dayNum = parseInt(dateStr.split('-')[2]);
                  const rec = empRecords[dateStr] || { status: '-' };
                  const style = getStatusStyle(rec.status);
                  const isToday = dateStr === now.toISOString().split('T')[0];
                  const hasData = rec.check_in;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => hasData && setDetailPopup({ emp, dateStr, rec })}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative group
                        ${style.bg} ${hasData ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 hover:scale-105' : 'cursor-default'}
                        ${isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
                      `}
                      title={`${dateStr}: ${style.label}${rec.workHours ? ' | Work: ' + rec.workHours : ''}`}
                    >
                      <span className={`text-xs font-bold ${isToday ? 'text-primary-700' : style.text}`}>{dayNum}</span>
                      {rec.status !== '-' && rec.status !== 'WEEKEND' && (
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mt-0.5`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Detail Popup Modal */}
      {detailPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setDetailPopup(null)}>
          <Card className="w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">{detailPopup.emp.name}</h3>
                <p className="text-xs text-slate-400">{new Date(detailPopup.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setDetailPopup(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Status badge */}
            <div className="mb-4">
              {(() => {
                const s = getStatusStyle(detailPopup.rec.status);
                return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</span>;
              })()}
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Clock size={16} className="text-primary-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Timing</p>
                  <p className="text-sm font-bold text-slate-800">
                    {formatTimeIST(detailPopup.rec.check_in)} → {detailPopup.rec.check_out ? formatTimeIST(detailPopup.rec.check_out) : <span className="text-amber-600">No checkout</span>}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-[11px] text-emerald-600 font-bold uppercase">Work Hours</p>
                  <p className="text-sm font-bold text-emerald-800">{detailPopup.rec.workHours || '0h 00m'}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-[11px] text-blue-600 font-bold uppercase">Break Time</p>
                  <p className="text-sm font-bold text-blue-800">{detailPopup.rec.breakTime || '0h 00m'}</p>
                </div>
              </div>

              {detailPopup.rec.remarks && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                  <FileText size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[11px] text-amber-600 font-bold uppercase">Remarks</p>
                    <p className="text-sm text-amber-800">{detailPopup.rec.remarks}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
