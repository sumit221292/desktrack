import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, Bell, Settings, LogOut, ChevronDown } from 'lucide-react';
import { Input } from '../ui/Input';

const Topbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex-1 max-w-xl">
        <Input 
          icon={Search} 
          placeholder="Search employees, shifts, leaves..." 
          className="bg-slate-100/50 border-transparent focus:bg-white transition-colors"
        />
      </div>

      <div className="flex items-center space-x-6">
        <button className="relative p-2 text-slate-400 hover:text-primary-600 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-alert-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-slate-200"></div>

        <div className="flex items-center space-x-3 cursor-pointer group">
          {user?.picture ? (
            <img src={user.picture} alt={user.name || user.email} className="w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover:shadow-md transition-all object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border-2 border-white shadow-sm group-hover:shadow-md transition-all">
              {(user?.name || user?.email)?.[0]?.toUpperCase() || 'A'}
            </div>
          )}
          <div className="hidden md:block">
            <p className="text-sm font-bold text-slate-700 leading-tight group-hover:text-primary-700 transition-colors">{user?.name || user?.email || 'Admin User'}</p>
            <p className="text-xs text-slate-500 font-medium">{user?.role || 'HR Admin'}</p>
          </div>
          <ChevronDown size={16} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
