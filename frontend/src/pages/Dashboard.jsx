import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, Clock, CheckCircle, TrendingUp, MoreVertical, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { motion } from 'framer-motion';
import { getStatusConfig } from '../utils/statusConfig';

// Live break display — ticks every second when on break, shows MM:SS
// completedMins = total break mins from completed breaks (no active session)
// activeStart = ISO start time of current active break (null if not on break)
const LiveBreakDisplay = ({ completedMins = 0, activeStart }) => {
  const [display, setDisplay] = useState('00:00');
  useEffect(() => {
    const tick = () => {
      let totalSec = Math.max(0, completedMins || 0) * 60;
      if (activeStart) {
        totalSec += Math.max(0, Math.floor((Date.now() - new Date(activeStart).getTime()) / 1000));
      }
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [completedMins, activeStart]);
  return <>{display}</>;
};

// Live work timer for dashboard
const DashboardLiveTimer = ({ checkIn, breakMins = 0, isLive, netMins }) => {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    if (!isLive) {
      const m = netMins || 0;
      setDisplay(`${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(checkIn).getTime()) / 60000) - (breakMins || 0);
      const m = Math.max(0, elapsed);
      setDisplay(`${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [checkIn, breakMins, isLive, netMins]);
  return <>{display}</>;
};

// Celebration overlay for birthdays/anniversaries
const CelebrationOverlay = ({ celebrations, onDismiss }) => {
  if (!celebrations || celebrations.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Floating balloons */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatUp {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-120px) rotate(15deg); opacity: 0; }
        }
        @keyframes floatUpSlow {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0.9; }
          60% { opacity: 0.9; }
          100% { transform: translateY(-120px) rotate(-10deg); opacity: 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0) translateY(40px); opacity: 0; }
          50% { transform: scale(1.1) translateY(-10px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes cakeWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        .balloon { animation: floatUp linear forwards; }
        .balloon-slow { animation: floatUpSlow linear forwards; }
        .confetti { animation: confettiFall linear forwards; }
        .celebration-card { animation: bounceIn 0.6s ease-out forwards; }
        .cake-wiggle { animation: cakeWiggle 0.5s ease-in-out infinite; }
      `}} />

      {/* Balloons */}
      {Array.from({ length: 16 }, (_, i) => {
        const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
        const left = Math.random() * 95;
        const dur = 4 + Math.random() * 5;
        const delay = Math.random() * 3;
        const size = 28 + Math.random() * 22;
        return (
          <div key={`b${i}`} className={i % 2 === 0 ? 'balloon' : 'balloon-slow'}
            style={{ position: 'fixed', left: `${left}%`, bottom: 0, zIndex: 201, animationDuration: `${dur}s`, animationDelay: `${delay}s`, fontSize: `${size}px` }}>
            🎈
          </div>
        );
      })}

      {/* Confetti */}
      {Array.from({ length: 30 }, (_, i) => {
        const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'];
        const left = Math.random() * 100;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 2;
        const w = 6 + Math.random() * 8;
        return (
          <div key={`c${i}`} className="confetti"
            style={{ position: 'fixed', left: `${left}%`, top: '-10px', zIndex: 201, width: `${w}px`, height: `${w * 0.4}px`, backgroundColor: colors[i % colors.length], borderRadius: '2px', animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
        );
      })}

      {/* Center celebration banner */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[202] pointer-events-auto max-w-lg w-full px-4">
        <div className="celebration-card bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl cake-wiggle">🎂</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Today's Celebrations!</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Let's make it special</p>
                </div>
              </div>
              <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors">✕</button>
            </div>
            <div className="mt-4 space-y-2">
              {celebrations.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${c.type === 'birthday' ? 'bg-pink-50 border border-pink-100' : 'bg-indigo-50 border border-indigo-100'}`}>
                  <span className="text-2xl">{c.type === 'birthday' ? '🎂' : '🎉'}</span>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${c.type === 'birthday' ? 'text-pink-800' : 'text-indigo-800'}`}>{c.name}</p>
                    <p className={`text-xs ${c.type === 'birthday' ? 'text-pink-500' : 'text-indigo-500'}`}>
                      {c.type === 'birthday' ? 'Happy Birthday! 🥳' : `🏆 ${c.years} Year${c.years > 1 ? 's' : ''} Work Anniversary!`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isCheckedIn, toggleCheckIn, selectedDate, setSelectedDate, breakConfig } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  const [selectedKPI, setSelectedKPI] = useState(null);
  const [stats, setStats] = useState([]);
  const [dummyDetails, setDummyDetails] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [productivityData, setProductivityData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [celebrations, setCelebrations] = useState([]);
  const [showCelebration, setShowCelebration] = useState(true);
  const [myAttendance, setMyAttendance] = useState(null);
  const [onLunch, setOnLunch] = useState(false);
  const [onTea, setOnTea] = useState(false);
  const [lunchStartTime, setLunchStartTime] = useState(null);
  const [teaStartTime, setTeaStartTime] = useState(null);
  const [lunchUsedMins, setLunchUsedMins] = useState(0);
  const [teaUsedMins, setTeaUsedMins] = useState(0);
  const [breakTick, setBreakTick] = useState(0);

  const lunchAllowed = breakConfig?.lunch_allowed_minutes || 45;
  const teaAllowed = breakConfig?.tea_allowed_minutes || 15;

  // Tick every second for countdown
  useEffect(() => {
    if (!onLunch && !onTea) return;
    const id = setInterval(() => setBreakTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [onLunch, onTea]);

  // Calculate live remaining for active break
  const getBreakCountdown = (type) => {
    const startTime = type === 'LUNCH' ? lunchStartTime : teaStartTime;
    const usedMins = type === 'LUNCH' ? lunchUsedMins : teaUsedMins;
    const allowed = type === 'LUNCH' ? lunchAllowed : teaAllowed;
    if (!startTime) return { remaining: allowed - usedMins, elapsed: 0, exceeded: false };
    const elapsedSec = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const totalUsedSec = (usedMins * 60) + elapsedSec;
    const remainingSec = (allowed * 60) - totalUsedSec;
    return { remaining: remainingSec, elapsed: elapsedSec, exceeded: remainingSec < 0 };
  };

  const fmtCountdown = (secs) => {
    const abs = Math.abs(Math.floor(secs));
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${secs < 0 ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleBreak = async (type) => {
    const isOn = type === 'LUNCH' ? onLunch : onTea;
    const eventType = isOn ? `${type}_END` : `${type}_START`;
    try {
      await api.post('/attendance/event', {
        event_type: eventType,
        event_time: new Date().toISOString(),
        attendance_id: myAttendance?.id || localStorage.getItem('attendanceId')
      });
      if (type === 'LUNCH') {
        if (isOn) {
          // Ending lunch — add elapsed to used
          const elapsed = lunchStartTime ? Math.ceil((Date.now() - new Date(lunchStartTime).getTime()) / 60000) : 0;
          setLunchUsedMins(prev => prev + elapsed);
          setLunchStartTime(null);
        } else {
          setLunchStartTime(new Date().toISOString());
        }
        setOnLunch(!isOn);
      } else {
        if (isOn) {
          const elapsed = teaStartTime ? Math.ceil((Date.now() - new Date(teaStartTime).getTime()) / 60000) : 0;
          setTeaUsedMins(prev => prev + elapsed);
          setTeaStartTime(null);
        } else {
          setTeaStartTime(new Date().toISOString());
        }
        setOnTea(!isOn);
      }
    } catch (err) {
      console.error('Break event error:', err);
      alert(err.response?.data?.error || 'Failed to log break');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return; // Guard against missing user context
      try {
        // Fetch Stats using the centralized api service
        const statsRes = await api.get(`/attendance/stats?date=${selectedDate}`);
        const statsData = statsRes.data || {};
        
        setStats([
          { label: 'Total Employees', value: (statsData.totalEmployees ?? 0).toString(), icon: Users, color: 'text-primary-600', bg: 'bg-primary-100', trend: 'From database' },
          { label: 'Present Today', value: (statsData.presentToday ?? 0).toString(), icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-100', trend: 'Verified' },
          { label: 'Late Arrivals', value: (statsData.lateArrivals ?? 0).toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', trend: 'Today' },
          { label: 'Productivity', value: statsData.productivity || '0%', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100', trend: 'Based on attendance' },
        ]);

        // Fetch Recent Activity (today's attendance)
        const attendanceRes = await api.get(`/attendance?date=${selectedDate}`);
        const attendanceData = attendanceRes.data;
        
        // Recent Activity: show arrival-based status
        const active = Array.isArray(attendanceData) ? attendanceData
          .filter(a => a.check_in && a.check_in !== '-' && !String(a.id).startsWith('no-ref-'))
          .map(a => {
            const statusStr = a.displayStatus || a.arrival_status || a.status || 'Present';
            const cfg = getStatusConfig(statusStr);
            return {
              name: a.name,
              time: new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
              status: statusStr,
              role: a.role || 'Employee',
              cfg
            };
          }) : [];

        // EMPLOYEE sees only their own activity; admin sees all
        if (isEmployee) {
          setRecentActivity(active.filter(a => a.name && user.email).slice(0, 10));
        } else {
          setRecentActivity(active.slice(0, 10));
        }

        // Current user's attendance for the status bar
        if (user && Array.isArray(attendanceData)) {
          const myRec = attendanceData.find(a => a.email === user.email && a.check_in && a.check_in !== '-');
          setMyAttendance(myRec || null);
          // Sync break status from attendance data
          if (myRec) {
            const lunchActive = myRec.lunch_status === 'INCOMPLETE';
            const teaActive = myRec.tea_status === 'INCOMPLETE';

            setOnLunch(lunchActive);
            setOnTea(teaActive);

            // Use backend's precise fields:
            // _active_start = latest unmatched START (current session)
            // _completed_minutes = only completed pairs (no active session)
            if (lunchActive) {
              setLunchStartTime(myRec.lunch_active_start || myRec.lunch_start || new Date().toISOString());
              setLunchUsedMins(parseInt(myRec.lunch_completed_minutes) || 0);
            } else {
              setLunchStartTime(null);
              setLunchUsedMins(parseInt(myRec.lunch_completed_minutes ?? myRec.lunch_actual_minutes) || 0);
            }

            if (teaActive) {
              setTeaStartTime(myRec.tea_active_start || myRec.tea_start || new Date().toISOString());
              setTeaUsedMins(parseInt(myRec.tea_completed_minutes) || 0);
            } else {
              setTeaStartTime(null);
              setTeaUsedMins(parseInt(myRec.tea_completed_minutes ?? myRec.tea_actual_minutes) || 0);
            }
          }

          // For EMPLOYEE: override stats with personal data
          if (isEmployee) {
            const myData = attendanceData.find(a => a.email === user.email);
            const isPresent = myData && myData.check_in && myData.check_in !== '-';
            const statusStr = (myData?.displayStatus || myData?.arrival_status || '').toUpperCase();
            setStats([
              { label: 'Status', value: isPresent ? 'Present' : 'Absent', icon: CheckCircle, color: isPresent ? 'text-success-600' : 'text-alert-600', bg: isPresent ? 'bg-success-100' : 'bg-alert-100', trend: 'Today' },
              { label: 'Arrival', value: statusStr || (isPresent ? 'ON TIME' : '-'), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', trend: 'Today' },
              { label: 'Work Hours', value: myData?.workHours || '0h 00m', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100', trend: 'Today' },
              { label: 'Break', value: myData?.breakTime || '0h 00m', icon: Clock, color: 'text-primary-600', bg: 'bg-primary-100', trend: 'Today' },
            ]);
          }
        }

        // Productivity Insights: fetch last 7 days
        try {
          const today = new Date(selectedDate);
          const dayOfWeek = today.getDay(); // 0=Sun
          const monday = new Date(today);
          monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // Get Monday

          const weekData = await Promise.all(
            [0, 1, 2, 3, 4, 5, 6].map(async (offset) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + offset);
              const dateStr = d.toISOString().split('T')[0];
              try {
                const res = await api.get(`/attendance/stats?date=${dateStr}`);
                return parseInt(res.data?.productivity) || 0;
              } catch { return 0; }
            })
          );
          setProductivityData(weekData);
        } catch { setProductivityData([0, 0, 0, 0, 0, 0, 0]); }
 
        setDummyDetails({
          'Total Employees': [
            { col1: 'Name', col2: 'Role', col3: 'Status' },
            ...(Array.isArray(attendanceData) ? attendanceData.map(e => ({ v1: e.name, v2: 'Employee', v3: 'Active', badge: 'success' })) : [])
          ],
          'Present Today': [
            { col1: 'Name', col2: 'Check-in Time', col3: 'Status' },
            ...active.map(e => ({ v1: e.name, v2: e.time, v3: e.cfg.label, statusCfg: e.cfg }))
          ],
          'Late Arrivals': [
            { col1: 'Name', col2: 'Arrival Time', col3: 'Status' },
            ...active.filter(e => e.status.toUpperCase().includes('LATE')).map(e => ({ v1: e.name, v2: e.time, v3: e.cfg.label, statusCfg: e.cfg }))
          ]
        });

        // Fetch celebrations (birthdays + anniversaries for today)
        try {
          const empRes = await api.get('/employees');
          const emps = empRes.data || [];
          const todayMD = new Date().toISOString().slice(5, 10); // MM-DD
          const thisYear = new Date().getFullYear();
          const celebs = [];
          emps.forEach(e => {
            const name = `${e.first_name || ''} ${e.last_name || ''}`.trim();
            if (e.date_of_birth) {
              const dobMD = String(e.date_of_birth).split('T')[0].slice(5);
              if (dobMD === todayMD) celebs.push({ type: 'birthday', name });
            }
            if (e.joining_date) {
              const jd = String(e.joining_date).split('T')[0];
              const jdMD = jd.slice(5);
              const jdYear = parseInt(jd.slice(0, 4));
              if (jdMD === todayMD && jdYear < thisYear) {
                celebs.push({ type: 'anniversary', name, years: thisYear - jdYear });
              }
            }
          });
          setCelebrations(celebs);
        } catch (e) { /* ignore */ }

      } catch (err) {
        console.error('Dashboard Fetch Error:', err);
      }
    };

    fetchData();
  }, [selectedDate, isCheckedIn, user]);

  const handleCheckInOut = () => {
    toggleCheckIn();
  };

  const getKPIValue = (label) => stats.find(s => s.label === label)?.value || '';

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Birthday / Anniversary Celebration */}
      {showCelebration && celebrations.length > 0 && (
        <CelebrationOverlay celebrations={celebrations} onDismiss={() => setShowCelebration(false)} />
      )}

      <header className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">Welcome Back!</h2>
            <p className="text-slate-500 font-medium text-sm">Here's what's happening at your company today.</p>
          </div>
          <div className="flex items-center gap-3">
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes intense-blink {
                0%, 100% { background-color: rgb(37 99 235); box-shadow: 0 0 0 0px rgba(37, 99, 235, 0.7); }
                50% { background-color: rgb(29 78 216); box-shadow: 0 0 15px 5px rgba(37, 99, 235, 0.4); }
              }
              @keyframes spin-clock { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}} />
            <button
              onClick={handleCheckInOut}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${
                isCheckedIn
                  ? 'bg-alert-500 text-white hover:bg-alert-600'
                  : 'bg-primary-600 text-white hover:bg-primary-700 animate-[intense-blink_1.5s_ease-in-out_infinite] ring-2 ring-primary-500 ring-offset-2 ring-offset-slate-50'
              }`}
            >
              {isCheckedIn ? <Clock size={16} style={{ animation: 'spin-clock 3s linear infinite' }} /> : <Clock size={16} />}
              {isCheckedIn ? 'Check Out' : 'Check In'}
            </button>
            <div className="relative group flex items-center bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600">
              <CalendarIcon size={16} className="text-primary-500 ml-2 absolute pointer-events-none" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-8 pr-2 py-1 bg-transparent border-none focus:ring-0 outline-none text-slate-700 cursor-pointer" style={{ colorScheme: 'light' }} />
            </div>
          </div>
        </div>

        {/* Attendance Status Strip — clean single row */}
        {myAttendance && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              {/* Left: Time info */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {new Date(myAttendance.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
                <div className="text-slate-300">→</div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Out</p>
                  <p className="text-lg font-bold text-slate-700">
                    {myAttendance.expectedCheckout && myAttendance.expectedCheckout !== '-'
                      ? new Date(myAttendance.expectedCheckout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
                      : '-'}
                  </p>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Working</p>
                  <p className="text-lg font-bold text-blue-600 font-mono">
                    <DashboardLiveTimer checkIn={myAttendance.check_in} breakMins={myAttendance.total_break_minutes || 0} isLive={myAttendance.is_checked_in} netMins={myAttendance.net_work_minutes} />
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Break</p>
                  <p className={`text-lg font-bold font-mono ${onLunch || onTea ? 'text-red-500' : 'text-amber-600'}`}>
                    <LiveBreakDisplay completedMins={lunchUsedMins + teaUsedMins} activeStart={onLunch ? lunchStartTime : onTea ? teaStartTime : null} />
                  </p>
                </div>
              </div>

              {/* Right: Break buttons */}
              {isCheckedIn && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const lunchCD = getBreakCountdown('LUNCH');
                    const teaCD = getBreakCountdown('TEA');
                    return (
                      <>
                        <button onClick={() => handleBreak('LUNCH')} disabled={onTea}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all
                            ${onTea ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' :
                              onLunch ? (lunchCD.exceeded ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white')
                              : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}>
                          🍽️ {onLunch ? <><span className="font-mono">{fmtCountdown(lunchCD.remaining)}</span></> : <>Lunch</>}
                        </button>
                        <button onClick={() => handleBreak('TEA')} disabled={onLunch}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all
                            ${onLunch ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' :
                              onTea ? (teaCD.exceeded ? 'bg-red-500 text-white animate-pulse' : 'bg-teal-500 text-white')
                              : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'}`}>
                          🍵 {onTea ? <><span className="font-mono">{fmtCountdown(teaCD.remaining)}</span></> : <>Tea</>}
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card 
              onClick={() => setSelectedKPI(stat.label)}
              className="hover:shadow-premium hover:border-primary-200 transition-all group cursor-pointer h-full flex flex-col justify-between transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300`}>
                  <stat.icon size={22} strokeWidth={2.5} />
                </div>
                <div className="text-slate-300 group-hover:text-primary-500 transition-colors">
                  <ChevronRight size={20} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 font-display mb-1">{stat.value}</p>
                <p className="text-sm text-slate-500 font-semibold group-hover:text-primary-700 transition-colors">{stat.label}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400">{stat.trend}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Productivity Insights */}
        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 font-display">Productivity Insights</h3>
            <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          
          <div className="flex flex-col h-[280px]">
            <div className="flex-1 flex items-end justify-between px-2 gap-3 pb-2 pt-6">
              {productivityData.map((h, i) => (
                <div key={i} className="flex-1 bg-slate-50/50 rounded-t-xl relative group h-full flex flex-col justify-end">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                    onClick={() => alert(`Productivity logged at ${h}% for this day.`)}
                    className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-xl cursor-pointer hover:from-primary-500 hover:to-primary-300 transition-all shadow-sm hover:shadow-md relative"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-lg whitespace-nowrap z-10 pointer-events-none">
                      {h}% Prod.
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-400 px-3 uppercase tracking-wider">
              <span className="flex-1 text-center">Mon</span>
              <span className="flex-1 text-center">Tue</span>
              <span className="flex-1 text-center">Wed</span>
              <span className="flex-1 text-center">Thu</span>
              <span className="flex-1 text-center">Fri</span>
              <span className="flex-1 text-center">Sat</span>
              <span className="flex-1 text-center">Sun</span>
            </div>
          </div>
        </Card>

        {/* Recent Attendance */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 font-display">Recent Activity</h3>
            <Link to="/attendance" className="text-primary-600 text-xs font-bold hover:underline">View All</Link>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {recentActivity.map((usr, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group border border-transparent hover:border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-primary-700 font-bold shadow-sm">
                    {usr.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm group-hover:text-primary-700 transition-colors">{usr.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{usr.role} &bull; Check-in: {usr.time}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${usr.cfg.tw}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: usr.cfg.color }} />{usr.cfg.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Modal isOpen={!!selectedKPI} onClose={() => setSelectedKPI(null)} title={`${selectedKPI} Details`} maxWidth="max-w-3xl">
        {selectedKPI && dummyDetails[selectedKPI] && (
          <div className="w-full overflow-x-auto custom-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-left whitespace-nowrap min-w-[500px]">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-3 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100">{dummyDetails[selectedKPI][0].col1}</th>
                  <th className="px-5 py-3 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100">{dummyDetails[selectedKPI][0].col2}</th>
                  <th className="px-5 py-3 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100 text-right">{dummyDetails[selectedKPI][0].col3}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dummyDetails[selectedKPI].slice(1).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-900 text-sm">{row.v1}</td>
                    <td className="px-5 py-3 font-medium text-slate-600 text-sm">{row.v2}</td>
                    <td className="px-5 py-3 text-right">
                      {row.statusCfg ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.statusCfg.tw}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.statusCfg.color }} />{row.v3}
                        </span>
                      ) : (
                        <Badge variant={row.badge || 'default'}>{row.v3}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center px-1">
               <p className="text-xs text-slate-500 font-medium tracking-wide">
                 Showing all {dummyDetails[selectedKPI].length - 1} records.
               </p>
               <button 
                 onClick={() => {
                   setSelectedKPI(null);
                   if (selectedKPI === 'Total Employees') navigate('/employees');
                   if (selectedKPI === 'Late Arrivals' || selectedKPI === 'Present Today') navigate('/attendance');
                   if (selectedKPI === 'Productivity') navigate('/reports');
                 }}
                 className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
               >
                 View Full Report &rarr;
               </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
