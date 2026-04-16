import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Clock, Calendar, CalendarDays,
  CreditCard, FileBarChart, Settings, LogOut,
  ChevronLeft, ChevronRight, TrendingUp
} from 'lucide-react';
import { cn } from '../ui/Button';
import Logo from '../ui/Logo';

const Sidebar = () => {
  const { user, logout, enabledModules, hasPermission } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Employees', path: '/employees', module: 'employees' },
    { icon: Clock, label: 'Attendance', path: '/attendance', module: 'attendance' },
    { icon: CalendarDays, label: 'Att. Calendar', path: '/attendance-calendar', module: 'attendance' },
    { icon: Calendar, label: 'Leaves', path: '/leaves', module: 'leaves' },
    { icon: CreditCard, label: 'Payroll', path: '/payroll', module: 'payroll' },
    { icon: TrendingUp, label: 'Performance', path: '/performance', module: 'performance' },
    { icon: FileBarChart, label: 'Reports', path: '/reports', module: 'reports' },
    { icon: Settings, label: 'Settings', path: '/settings', module: 'settings' },
  ].filter(item => {
    if (item.module && !enabledModules[item.module] && item.module !== 'settings') return false;
    if (item.module && !hasPermission(item.module, 'view')) return false;
    return true;
  });

  return (
    <aside className={cn(
      "h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-40 sticky top-0",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("p-6 flex items-center justify-between", collapsed && "justify-center p-4")}>
        {!collapsed && (
          <div className="flex items-center space-x-2 overflow-hidden">
            <Logo size={30} className="shrink-0" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display whitespace-nowrap">DeskTrack</h1>
          </div>
        )}
        {collapsed && (
          <Logo size={36} className="shrink-0" />
        )}
      </div>

      <div className="px-4 py-2">
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 pl-0 rounded-lg transition-colors border border-dashed border-slate-200"
        >
          {collapsed ? <ChevronRight size={18} /> : <div className="flex items-center justify-between w-full px-2"><span className="text-xs font-bold uppercase tracking-wider">Menu</span><ChevronLeft size={18}/></div>}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-4 custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center px-3 py-3 rounded-xl transition-all group relative",
                isActive 
                  ? "bg-primary-50 text-primary-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-primary-600 font-medium",
                collapsed ? "justify-center" : "space-x-4"
              )}
            >
              <item.icon size={20} className={cn("shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
              {!collapsed && <span>{item.label}</span>}
              
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={logout}
          className={cn(
            "flex items-center w-full px-3 py-3 text-slate-500 hover:bg-alert-50 hover:text-alert-600 rounded-xl transition-all group",
            collapsed ? "justify-center" : "space-x-4"
          )}
        >
          <LogOut size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
          {!collapsed && <span className="font-medium font-display">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
