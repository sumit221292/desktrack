import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, FileText, Search, Cake, Award } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { STATUS_CONFIG, getStatusConfig } from '../utils/statusConfig';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const getS = (status) => getStatusConfig(status);

// Mini calendar for sidebar
const MiniCalendar = ({ month, year, today, onDayClick, selectedDate }) => {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().split('T')[0];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {Array.from({ length: firstDow }, (_, i) => <div key={`p${i}`} className="h-7" />)}
        {Array.from({ length: lastDay }, (_, i) => {
          const d = i + 1;
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={d}
              onClick={() => onDayClick(dateStr)}
              className={`h-7 w-7 mx-auto rounded-full text-xs font-medium transition-colors
              ${isToday ? 'bg-blue-600 text-white' : isSelected ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >{d}</button>
          );
        })}
      </div>
    </div>
  );
};

// Detailed single-employee view: summary panel + per-day status grid with times.
const IndividualCalendar = ({ emp, records, specialEvents, weeks, month, year, todayStr }) => {
  const recs = records[emp.id] || {};
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }); } catch { return ''; } };

  // Tally the month's per-day records
  const c = { present: 0, late: 0, absent: 0, halfday: 0, leave: 0, holiday: 0, weekoff: 0, lop: 0 };
  let workingDays = 0, elapsedWorking = 0;
  const dim = new Date(year, month, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const s = (recs[ds]?.status || '-').toUpperCase();
    if (s === 'WEEKEND') { c.weekoff++; continue; }
    if (s === 'OFFICE HOLIDAY' || s === 'PUBLIC HOLIDAY') { c.holiday++; continue; }
    workingDays++;
    if (ds <= todayStr) elapsedWorking++;
    if (s === 'PRESENT' || s === 'ON TIME' || s === 'COMPLETE') c.present++;
    else if (s === 'LATE' || s === 'LATE_ARRIVAL' || s === 'OVER LATE' || s === 'OVERLATE') c.late++;
    else if (s === 'HALF DAY' || s === 'HALFDAY') c.halfday++;
    else if (s === 'LEAVE') c.leave++;
    else if (s === 'LOP') c.lop++;
    else if (s === 'ABSENT') c.absent++;
  }
  const attended = c.present + c.late + c.halfday;
  const payable = c.present + c.late + 0.5 * c.halfday + c.leave;
  const pct = elapsedWorking > 0 ? Math.round(attended / elapsedWorking * 100) : 0;
  const cards = [
    ['Present', c.present, 'PRESENT'], ['Late', c.late, 'LATE'], ['Absent', c.absent, 'ABSENT'],
    ['Half Day', c.halfday, 'HALF DAY'], ['Leave', c.leave, 'LEAVE'], ['Holiday', c.holiday, 'OFFICE HOLIDAY'],
    ['Week-Off', c.weekoff, 'WEEKEND'], ['LOP', c.lop, 'LOP'],
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{emp.name} — Attendance Summary</h2>
        <p className="text-xs text-slate-500">{MONTH_NAMES[month - 1]} {year}</p>
      </div>

      {/* Status count cards */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2.5">
        {cards.map(([label, val, key]) => { const cfg = getStatusConfig(key); return (
          <div key={label} className="rounded-xl border p-3 text-center" style={{ borderColor: cfg.border, background: cfg.bg }}>
            <p className="text-2xl font-black" style={{ color: cfg.color }}>{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>{label}</p>
          </div>
        ); })}
      </div>

      {/* Derived metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Attendance</p>
          <p className="text-2xl font-black text-emerald-600">{pct}%</p>
          <p className="text-[10px] text-slate-400">{workingDays} working days · {attended} present</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Approved Leave</p>
          <p className="text-2xl font-black text-blue-600">{c.leave + c.lop}<span className="text-sm font-medium text-slate-400"> days</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">LOP</p>
          <p className="text-2xl font-black text-slate-800">{c.lop}<span className="text-sm font-medium text-slate-400"> days</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Payable Days</p>
          <p className="text-2xl font-black text-emerald-600">{payable}</p>
        </div>
      </div>

      {/* Month grid (per-day status) */}
      <table className="w-full border-collapse table-fixed">
        <thead><tr>{DAY_HEADERS.map((d, i) => <th key={d} className={`text-[11px] font-medium py-2 border-b border-slate-200 text-center ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'}`}>{d}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) return <td key={`e-${di}`} className="border border-slate-100 bg-slate-50/50 h-24" />;
                const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const r = recs[ds] || { status: '-' };
                const s = (r.status || '-').toUpperCase();
                const cfg = getStatusConfig(s);
                const isWeekend = di === 0 || di === 6;
                const isToday = ds === todayStr;
                const isAttend = ['PRESENT', 'ON TIME', 'COMPLETE', 'LATE', 'OVER LATE', 'OVERLATE', 'HALF DAY', 'HALFDAY'].includes(s);
                // Show the actual check-in → check-out + work time whenever there IS a
                // check-in — even on an ABSENT day (came in but left before the half-shift
                // mark) — so the person's activity is visible, not just a bare "Absent".
                const hasActivity = isAttend || !!r.check_in;
                // Non-attend sub-line (leave code / holiday name)
                const sub = s === 'LEAVE' ? (r.leaveCode || 'Leave')
                  : s === 'OFFICE HOLIDAY' ? ((specialEvents[ds] || []).find(e => e.type === 'holiday')?.name || '') : null;
                return (
                  <td key={day} className={`border border-slate-100 align-top p-1.5 h-28 ${isWeekend ? 'bg-slate-50/60' : 'bg-white'}`}>
                    <div className="flex justify-end mb-1">
                      <span className={`text-xs font-semibold ${isToday ? 'w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded-full' : 'text-slate-500'}`}>{day}</span>
                    </div>
                    {s !== '-' && (
                      <div className="rounded-md px-1 py-1 text-center" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <p className="text-[11px] font-bold leading-tight truncate" style={{ color: cfg.color }}>{cfg.label}</p>
                        {hasActivity ? (
                          <>
                            <p className="text-[9px] mt-0.5 leading-tight truncate font-mono" style={{ color: cfg.color }}>
                              {r.check_in ? fmtTime(r.check_in) : '—'} → {r.check_out ? fmtTime(r.check_out) : (r.is_checked_in ? 'In' : 'Missed')}
                            </p>
                            {r.workHours && <p className="text-[10px] font-bold leading-tight" style={{ color: cfg.color }}>{r.workHours}</p>}
                          </>
                        ) : (sub && <p className="text-[9px] mt-0.5 truncate" style={{ color: cfg.color }}>{sub}</p>)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AttendanceCalendar = () => {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibleEmps, setVisibleEmps] = useState({});
  const [detailPopup, setDetailPopup] = useState(null); // { type: 'day', dateStr, records } or { type: 'entry', emp, dateStr, rec }
  const [empSearch, setEmpSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const isEmployee = user?.role === 'EMPLOYEE';

  const isCurrentMonth = month === (now.getMonth() + 1) && year === now.getFullYear();

  // `silent` refreshes data without touching the loading state or the user's
  // employee selection — used by the realtime poll so today's cell stays live
  // without flicker or losing the selected employee.
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/attendance/monthly?month=${month}&year=${year}`);
      let resData = res.data;
      // EMPLOYEE: filter to only their own data
      if (isEmployee && user?.email) {
        const myEmp = resData.employees.find(e => e.email === user.email);
        if (myEmp) {
          resData = { ...resData, employees: [myEmp] };
        }
      }
      setData(resData);
      // Only on the initial (non-silent) load: default to a SINGLE employee so
      // the calendar opens in the detailed individual view. A silent poll must
      // never clobber whatever employee the user is currently viewing.
      if (!silent) {
        const def = (isEmployee && user?.email)
          ? resData.employees.find(e => e.email === user.email)
          : resData.employees[0];
        const vis = {};
        resData.employees.forEach(e => { vis[e.id] = def ? e.id === def.id : true; });
        setVisibleEmps(vis);
      }
    } catch (err) {
      console.error('Failed to fetch monthly attendance:', err);
    }
    if (!silent) setLoading(false);
  }, [month, year, isEmployee, user?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: silently re-fetch the current month every 10s so today's status
  // (Checked In / On Time / Late), check-in time and work hours stay live —
  // same idea as the dashboard's Recent Activity. Past months never change, so
  // they aren't polled; polling pauses while the tab is hidden.
  useEffect(() => {
    if (!isCurrentMonth) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchData(true);
    }, 10000);
    return () => clearInterval(id);
  }, [isCurrentMonth, fetchData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); setSelectedDate(null); };

  const toggleEmp = (id) => setVisibleEmps(v => ({ ...v, [id]: !v[id] }));
  // Click an employee's name → view ONLY them (detailed individual view)
  const selectOnly = (id) => { const next = {}; (data?.employees || []).forEach(e => { next[e.id] = e.id === id; }); setVisibleEmps(next); };
  const allVisible = data ? data.employees.every(e => visibleEmps[e.id]) : false;
  const toggleAll = () => {
    if (!data) return;
    const next = {};
    data.employees.forEach(e => { next[e.id] = !allVisible; });
    setVisibleEmps(next);
  };

  const formatTimeIST = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }); }
    catch { return '-'; }
  };

  const todayStr = now.toISOString().split('T')[0];
  const firstDow = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();

  const weeks = [];
  let currentWeek = Array(firstDow).fill(null);
  for (let d = 1; d <= lastDay; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const filteredEmps = data ? data.employees.filter(e => {
    if (!visibleEmps[e.id]) return false;
    if (empSearch && !e.name.toLowerCase().includes(empSearch.toLowerCase())) return false;
    return true;
  }) : [];

  // Exactly one employee selected → detailed individual view; else team matrix.
  const individual = filteredEmps.length === 1 ? filteredEmps[0] : null;

  // Day click handler - show all employees' attendance for that day
  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr);
    if (!data) return;
    const dayRecords = filteredEmps.map(emp => {
      const rec = data.records[emp.id]?.[dateStr] || { status: '-' };
      return { emp, rec };
    });
    const specialEvts = (data.specialEvents?.[dateStr] || []);
    setDetailPopup({ type: 'day', dateStr, dayRecords, specialEvts });
  };

  // Mini calendar day click
  const handleMiniDayClick = (dateStr) => {
    handleDayClick(dateStr);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* LEFT SIDEBAR */}
      <div className="w-60 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        {/* Mini calendar */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={14} className="text-slate-500" /></button>
            <span className="text-sm font-semibold text-slate-700">{MONTH_SHORT[month-1]} {year}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={14} className="text-slate-500" /></button>
          </div>
          <MiniCalendar month={month} year={year} today={now} onDayClick={handleMiniDayClick} selectedDate={selectedDate} />
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-2">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Search people" value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-slate-50 rounded">
              <input type="checkbox" checked={allVisible} onChange={toggleAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">All Employees</span>
            </label>
          </div>
          <div className="px-3 pb-3 space-y-0.5">
            {(data?.employees || []).filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
              <div key={emp.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50">
                <input type="checkbox" checked={!!visibleEmps[emp.id]} onChange={() => toggleEmp(emp.id)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                <div onClick={() => selectOnly(emp.id)} title="View only this employee"
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                    {emp.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate">{emp.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-1">
            {['PRESENT','LATE','OVER LATE','HALF DAY','ABSENT','LEAVE','LOP','WEEKEND','OFFICE HOLIDAY'].map(key => {
              const val = getStatusConfig(key);
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: val.color }} />
                  <span className="text-[10px] text-slate-500">{val.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <Cake size={10} className="text-pink-500 shrink-0" />
              <span className="text-[10px] text-slate-500">Birthday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award size={10} className="text-indigo-500 shrink-0" />
              <span className="text-[10px] text-slate-500">Anniversary</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CALENDAR */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={goToday} className="px-4 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">Today</button>
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20} className="text-slate-600" /></button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={20} className="text-slate-600" /></button>
            <h1 className="text-xl font-normal text-slate-800">{MONTH_NAMES[month - 1]} {year}</h1>
          </div>
          {data && <span className="text-xs text-slate-500">{filteredEmps.length} employee{filteredEmps.length !== 1 ? 's' : ''}</span>}
        </div>

        {/* Grid */}
        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : individual ? (
          <IndividualCalendar emp={individual} records={data.records} specialEvents={data.specialEvents || {}} weeks={weeks} month={month} year={year} todayStr={todayStr} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  {DAY_HEADERS.map((d, i) => (
                    <th key={d} className={`text-[11px] font-medium py-2 border-b border-slate-200 text-center
                      ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'}`}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      if (day === null) {
                        return <td key={`e-${di}`} className="border-r border-b border-slate-100 bg-slate-50/50 h-28" />;
                      }

                      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const isToday = dateStr === todayStr;
                      const isWeekend = di === 0 || di === 6;
                      const isSelected = dateStr === selectedDate;
                      const specialEvts = data.specialEvents?.[dateStr] || [];

                      return (
                        <td
                          key={day}
                          onClick={() => handleDayClick(dateStr)}
                          className={`border-r border-b border-slate-100 align-top p-0 h-28 transition-colors cursor-pointer
                            ${isWeekend ? 'bg-slate-50/70' : 'bg-white'}
                            ${isSelected ? 'bg-blue-50' : 'hover:bg-blue-50/40'}`}
                        >
                          {/* Date number */}
                          <div className="px-2 pt-1.5 pb-1 flex justify-between items-center">
                            {isWeekend
                              ? <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1 py-0.5">Week-off</span>
                              : <span />}
                            <span className={`text-xs font-medium leading-none flex items-center justify-center
                              ${isToday ? 'w-6 h-6 bg-blue-600 text-white rounded-full' : isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                              {day}
                            </span>
                          </div>

                          {/* Special events (holiday / birthday / anniversary) */}
                          <div className="px-1 space-y-[2px] overflow-y-auto max-h-[84px] custom-scrollbar">
                            {specialEvts.map((evt, ei) => {
                              const isHol = evt.type === 'holiday';
                              const isBday = evt.type === 'birthday';
                              const cls = isHol ? 'bg-amber-50 text-amber-700 border-amber-400'
                                : isBday ? 'bg-pink-50 text-pink-600 border-pink-400'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-400';
                              const label = isHol ? `🎌 ${evt.name}`
                                : isBday ? `🎂 ${evt.name.split(' ')[0]} Birthday`
                                : `🎉 ${evt.name.split(' ')[0]} ${evt.years}yr Anniv.`;
                              return (
                                <div key={`evt-${ei}`} title={isHol ? evt.name : undefined}
                                  className={`w-full rounded-[4px] px-1.5 py-[3px] text-[10px] font-medium truncate border-l-[3px] ${cls}`}>
                                  {label}
                                </div>
                              );
                            })}

                            {/* Employee attendance chips */}
                            {filteredEmps.map(emp => {
                              const rec = data.records[emp.id]?.[dateStr] || { status: '-' };
                              if (rec.status === '-') return null;
                              const s = getS(rec.status);

                              return (
                                <div
                                  key={emp.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (rec.check_in) setDetailPopup({ type: 'entry', emp, dateStr, rec });
                                  }}
                                  className={`w-full text-left rounded-[4px] px-1.5 py-[3px] text-[10px] font-medium truncate block
                                    ${rec.check_in ? 'cursor-pointer hover:opacity-80' : ''}`}
                                  style={{ backgroundColor: s.bg, color: s.color, borderLeft: `3px solid ${s.color}` }}
                                  title={`${emp.name}: ${s.label}${rec.workHours ? ' | ' + rec.workHours : ''}`}
                                >
                                  {emp.name.split(' ')[0]} - {s.short}{rec.workHours && rec.check_in && rec.status !== 'WEEKEND' ? ` ${rec.workHours}` : ''}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL POPUP */}
      {detailPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20" onClick={() => { setDetailPopup(null); setSelectedDate(null); }}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Day view */}
            {detailPopup.type === 'day' && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {new Date(detailPopup.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                  </div>
                  <button onClick={() => { setDetailPopup(null); setSelectedDate(null); }} className="p-1 hover:bg-slate-100 rounded-full">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                  {/* Special events */}
                  {detailPopup.specialEvts?.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {detailPopup.specialEvts.map((evt, i) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg
                          ${evt.type === 'birthday' ? 'bg-pink-50 border border-pink-200' : 'bg-indigo-50 border border-indigo-200'}`}>
                          {evt.type === 'birthday' ? <Cake size={18} className="text-pink-500" /> : <Award size={18} className="text-indigo-500" />}
                          <div>
                            <p className={`text-sm font-semibold ${evt.type === 'birthday' ? 'text-pink-700' : 'text-indigo-700'}`}>
                              {evt.name}
                            </p>
                            <p className={`text-xs ${evt.type === 'birthday' ? 'text-pink-500' : 'text-indigo-500'}`}>
                              {evt.type === 'birthday' ? 'Happy Birthday!' : `${evt.years} Year Work Anniversary`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Employee attendance list */}
                  {detailPopup.dayRecords?.map(({ emp, rec }) => {
                    const s = getS(rec.status);
                    return (
                      <div key={emp.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-100 transition-colors
                          ${rec.check_in ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                        onClick={() => rec.check_in && setDetailPopup({ type: 'entry', emp, dateStr: detailPopup.dateStr, rec })}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {rec.check_in ? `${formatTimeIST(rec.check_in)}${rec.check_out ? ' → ' + formatTimeIST(rec.check_out) : ''}` : '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rec.workHours && rec.check_in && rec.status !== 'WEEKEND' && rec.status !== '-' && (
                            <span className="text-[11px] font-medium text-slate-500">{rec.workHours}</span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: s.bg, color: s.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.short || s.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Single entry detail */}
            {detailPopup.type === 'entry' && (
              <>
                <div className="h-2 shrink-0" style={{ backgroundColor: getS(detailPopup.rec.status).color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-slate-900">{detailPopup.emp.name}</h3>
                      <p className="text-sm text-slate-500">{new Date(detailPopup.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <button onClick={() => setDetailPopup(null)} className="p-1 hover:bg-slate-100 rounded-full">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  {(() => {
                    const s = getS(detailPopup.rec.status);
                    return (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                        style={{ backgroundColor: s.bg, color: s.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </div>
                    );
                  })()}

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg">
                      <Clock size={18} className="text-blue-500" />
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium uppercase">Check-in / Check-out</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatTimeIST(detailPopup.rec.check_in)}
                          <span className="text-slate-300 mx-2">&rarr;</span>
                          {detailPopup.rec.check_out ? formatTimeIST(detailPopup.rec.check_out) : <span className="text-amber-500">Missed</span>}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="px-4 py-3 rounded-lg bg-emerald-50">
                        <p className="text-[11px] text-emerald-500 font-medium uppercase">Work Hours</p>
                        <p className="text-base font-semibold text-emerald-700">{detailPopup.rec.workHours || '0h 00m'}</p>
                      </div>
                      <div className="px-4 py-3 rounded-lg bg-blue-50">
                        <p className="text-[11px] text-blue-500 font-medium uppercase">Break Time</p>
                        <p className="text-base font-semibold text-blue-700">{detailPopup.rec.breakTime || '0h 00m'}</p>
                      </div>
                    </div>

                    {detailPopup.rec.remarks && (
                      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-lg">
                        <FileText size={16} className="text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-amber-500 font-medium uppercase">Remarks</p>
                          <p className="text-sm text-amber-800">{detailPopup.rec.remarks}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
