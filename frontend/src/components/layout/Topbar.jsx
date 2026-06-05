import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Search, Bell, Settings, LogOut, ChevronDown } from 'lucide-react';
import { Input } from '../ui/Input';

const Topbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchVal.trim();
    navigate(q ? `/employees?q=${encodeURIComponent(q)}` : '/employees');
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <Input
          icon={Search}
          placeholder="Search employees… (press Enter)"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          className="bg-slate-100/50 border-transparent focus:bg-white transition-colors"
        />
      </form>

      <div className="flex items-center space-x-6">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(v => !v); setShowProfile(false); }}
            className="relative p-2 text-slate-400 hover:text-primary-600 transition-colors"
          >
            <Bell size={20} />
          </button>
          {showNotif && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowNotif(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-700">Notifications</div>
                <div className="px-4 py-10 text-center text-sm text-slate-400">No new notifications</div>
              </div>
            </>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200"></div>

        {/* Profile */}
        <div className="relative">
          <div
            onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            {user?.picture ? (
              <img src={user.picture} alt={user.name || user.email} className="w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover:shadow-md transition-all object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border-2 border-white shadow-sm group-hover:shadow-md transition-all">
                {(user?.name || user?.email)?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            <div className="hidden md:block">
              <p className="text-sm font-bold text-slate-700 leading-tight group-hover:text-primary-700 transition-colors">{user?.name || user?.email || 'Admin User'}</p>
              <p className="text-xs text-slate-500 font-medium">{user?.designation || user?.role || 'HR Admin'}</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 group-hover:text-primary-600 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </div>
          {showProfile && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-700 truncate">{user?.name || user?.email}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowProfile(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={16} /> Settings
                </button>
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
