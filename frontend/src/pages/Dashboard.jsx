import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, Clock, CheckCircle, TrendingUp, MoreVertical, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const navigate = useNavigate();
  // Fetch real data from backend
  const { user, isCheckedIn, toggleCheckIn, selectedDate, setSelectedDate } = useAuth();
  
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [stats, setStats] = useState([]);
  const [dummyDetails, setDummyDetails] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [productivityData, setProductivityData] = useState([0, 0, 0, 0, 0, 0, 0]);

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
        
        // Defensive check: Ensure attendanceData is an array before filtering
        const active = Array.isArray(attendanceData) ? attendanceData
          .filter(a => a.status !== 'Absent' && a.check_in)
          .map(a => ({
            name: a.name,
            time: new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
            status: (a.status || '').replace('_', ' '),
            role: 'Employee',
            variant: (a.status || '') === 'Present' ? 'success' : 'warning'
          })) : [];
        
        setRecentActivity(active.slice(0, 5));
        
        // Reset productivity chart until historical data is available
        setProductivityData([0, 0, 0, 0, 0, 0, 0]);
 
        setDummyDetails({
          'Total Employees': [
            { col1: 'Name', col2: 'Role', col3: 'Status' },
            ...(Array.isArray(attendanceData) ? attendanceData.map(e => ({ v1: e.name, v2: 'Employee', v3: 'Active', badge: 'success' })) : [])
          ],
          'Present Today': [
            { col1: 'Name', col2: 'Check-in Time', col3: 'Status' },
            ...active.map(e => ({ v1: e.name, v2: e.time, v3: e.status, badge: e.variant }))
          ],
          'Late Arrivals': [
            { col1: 'Name', col2: 'Arrival Time', col3: 'Status' },
            ...active.filter(e => e.status.includes('Late')).map(e => ({ v1: e.name, v2: e.time, v3: e.status, badge: 'warning' }))
          ]
        });

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">Welcome Back!</h2>
          <p className="text-slate-500 font-medium text-sm">Here's what's happening at your company today.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes intense-blink {
              0%, 100% { background-color: rgb(37 99 235); box-shadow: 0 0 0 0px rgba(37, 99, 235, 0.7); }
              50% { background-color: rgb(29 78 216); box-shadow: 0 0 15px 5px rgba(37, 99, 235, 0.4); }
            }
          `}} />
          <button 
            onClick={handleCheckInOut}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all ${
              isCheckedIn 
                ? 'bg-alert-500 text-white hover:bg-alert-600' 
                : 'bg-primary-600 text-white hover:bg-primary-700 animate-[intense-blink_1.5s_ease-in-out_infinite] ring-2 ring-primary-500 ring-offset-2 ring-offset-slate-50'
            }`}
          >
            <Clock size={16} />
            {isCheckedIn ? 'Check Out Now' : 'Check In Now'}
          </button>

          <div className="relative group flex items-center bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all cursor-pointer">
            <CalendarIcon size={16} className="text-primary-500 ml-2 absolute pointer-events-none" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-8 pr-2 py-1 bg-transparent border-none focus:ring-0 outline-none text-slate-700 cursor-pointer w-full appearance-none relative z-10"
              style={{ colorScheme: 'light' }}
            />
          </div>
        </div>
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
                <Badge variant={usr.variant}>{usr.status}</Badge>
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
                      <Badge variant={row.badge}>{row.v3}</Badge>
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
