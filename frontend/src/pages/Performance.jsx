import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, Award, Star, ArrowUpRight, ArrowDownRight, Zap, Shield, User, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const StatCard = ({ title, value, trend, trendValue, icon: Icon, color }) => (
  <Card className="hover:shadow-lg transition-all border-none bg-white overflow-hidden group">
    <div className="flex items-center justify-between p-1">
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        <div className="flex items-center space-x-1">
          {trend === 'up' ? (
            <ArrowUpRight size={14} className="text-emerald-500" />
          ) : (
            <ArrowDownRight size={14} className="text-alert-500" />
          )}
          <span className={`text-xs font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-alert-600'}`}>
            {trendValue}
          </span>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">vs last month</span>
        </div>
      </div>
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={28} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </Card>
);

const ProgressBar = ({ label, value, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}%</span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full ${color}`}
      ></motion.div>
    </div>
  </div>
);

const Performance = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/performance/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Error fetching performance stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-primary-600" size={48} />
        <p className="text-slate-500 font-medium animate-pulse">Calculating real-time analytics...</p>
      </div>
    );
  }

  if (!stats) return <div className="p-8 text-center text-slate-500">Failed to load performance data.</div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display">Performance Analytics</h2>
          <p className="text-slate-500 font-medium">Real-time KPI tracking and employee appraisal overview.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
           <Badge variant="success" className="px-3 py-1 ring-4 ring-emerald-50">Live Sync Active</Badge>
           <span className="text-[10px] font-bold text-slate-400 uppercase pr-2">Updated 2m ago</span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Team Productivity" value={stats.productivity} trend="up" trendValue="+2.4%" icon={Zap} color="bg-amber-500" />
        <StatCard title="Active KPIs" value={stats.activeKPIs} trend="up" trendValue="+4" icon={Target} color="bg-primary-500" />
        <StatCard title="Overall Score" value={stats.overallScore} trend="down" trendValue="-0.1" icon={Star} color="bg-indigo-500" />
        <StatCard title="Evaluations" value={stats.evaluations} trend="up" trendValue="+1" icon={Users} color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KPI Charts Section */}
        <Card className="lg:col-span-2 space-y-8 shadow-premium">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
              <TrendingUp size={20} className="text-primary-600" />
              Efficiency Trends
            </h3>
            <select className="text-xs font-bold bg-slate-50 border-none rounded-lg focus:ring-0 cursor-pointer text-slate-600">
              <option>Last 30 Days</option>
              <option>Last 6 Months</option>
            </select>
          </div>
          
          <div className="h-[250px] w-full flex items-end justify-between space-x-2 px-2">
            {(stats.efficiencyTrends || [40, 70, 45, 90, 65, 80, 95]).map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: i * 0.1, duration: 0.8 }}
                  className={`w-full rounded-t-xl transition-all duration-300 ${i === 6 ? 'bg-primary-600 shadow-lg shadow-primary-500/30' : 'bg-primary-100 group-hover:bg-primary-200'}`}
                ></motion.div>
                <span className="text-[10px] font-bold text-slate-400 mt-3 group-hover:text-slate-600">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </span>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-50">
            <ProgressBar label="Attendance Consistency" value={stats.attendanceConsistency || 96} color="bg-emerald-500" />
            <ProgressBar label="Project Completion" value={stats.projectCompletion || 82} color="bg-primary-500" />
          </div>
        </Card>

        {/* Top Performers Section */}
        <div className="space-y-6">
          <Card className="shadow-premium overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Award size={100} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display mb-6">Top Performers</h3>
            <div className="space-y-6">
              {stats.topPerformers.map((person, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate(`/employees/${person.id}`)}
                  className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-black text-primary-700 border border-slate-200 group-hover:bg-primary-50 transition-colors">
                      {person.image}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{person.name}</p>
                      <p className="text-[11px] font-medium text-slate-400">{person.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-primary-600">{person.score}%</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} size={8} className={s <= 4 ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors uppercase tracking-widest">
              View All Rankings
            </button>
          </Card>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Shield size={20} />
              </div>
              <h4 className="font-bold">Next Appraisal Cycle</h4>
            </div>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">Your next organization-wide performance review starts in <span className="text-white font-bold">12 days</span>.</p>
            <div className="flex -space-x-2">
               {[1,2,3,4].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-700 bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
                   <User size={14} />
                 </div>
               ))}
               <div className="w-8 h-8 rounded-full border-2 border-indigo-700 bg-indigo-900 flex items-center justify-center text-[10px] font-bold">
                 +8
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
