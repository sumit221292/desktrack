import React, { useState } from 'react';
import { FileBarChart, Filter, Search, DownloadCloud, Activity, Users, Clock, CheckCircle, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import api from '../services/api';

const CATEGORIES = ['All', 'HR & People', 'Time & Attendance', 'Financial'];

const Reports = () => {
  const { selectedDate } = useAuth();
  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const d = new Date(selectedDate);
  const M = d.getMonth() + 1, Y = d.getFullYear();
  const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const REPORTS = [
    { id: 'RPT-EMP', name: 'Employee Directory', category: 'HR & People', desc: 'All employees with code, role, status & joining date.', fetch: () => api.get('/employees') },
    { id: 'RPT-ATT', name: `Attendance — ${formattedDate}`, category: 'Time & Attendance', desc: `Per-employee attendance for ${formattedDate}.`, fetch: () => api.get(`/attendance?date=${selectedDate}`) },
    { id: 'RPT-PAY', name: `Payroll — ${monthLabel}`, category: 'Financial', desc: `Processed payroll records for ${monthLabel}.`, fetch: () => api.get(`/payroll?month=${M}&year=${Y}`) },
  ];

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCategory, setShowCategory] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [busy, setBusy] = useState(null);

  const downloadCsv = (rows, filename) => {
    const flat = rows.map(r => {
      const o = {};
      Object.entries(r).forEach(([k, v]) => { o[k] = (v && typeof v === 'object') ? JSON.stringify(v) : v; });
      return o;
    });
    const headers = [...new Set(flat.flatMap(r => Object.keys(r)))];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    flat.forEach(r => lines.push(headers.map(h => esc(r[h])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const generate = async (rpt) => {
    setShowGenerate(false);
    setBusy(rpt.id);
    try {
      const res = await rpt.fetch();
      let rows = res.data;
      if (!Array.isArray(rows)) rows = rows?.records || rows?.data || rows?.attendance || [];
      if (!rows || !rows.length) { alert(`No data available for "${rpt.name}".`); return; }
      downloadCsv(rows, `${rpt.id}-${new Date().toISOString().slice(0, 10)}.csv`);
      setGenCount(c => c + 1);
    } catch (e) {
      alert('Failed to generate report: ' + (e.response?.data?.error || e.message));
    } finally {
      setBusy(null);
    }
  };

  const visible = REPORTS.filter(r =>
    (categoryFilter === 'All' || r.category === categoryFilter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()))
  );

  const countIn = (cat) => REPORTS.filter(r => r.category === cat).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">Analytics & Reports</h2>
          <p className="text-slate-500 font-medium text-sm">Generate, view, and export data insights.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative group flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600 transition-all">
            <CalendarIcon size={16} className="text-primary-500 mr-2" />
            <span className="text-slate-700 text-sm">{formattedDate}</span>
          </div>
          <div className="relative">
            <Button onClick={() => setShowGenerate(v => !v)} className="gap-2 shadow-lg h-[42px]">
              <FileBarChart size={18} /> Generate New Report <ChevronDown size={16} className={showGenerate ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </Button>
            {showGenerate && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowGenerate(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose a report to export (CSV)</p>
                  {REPORTS.map(r => (
                    <button key={r.id} onClick={() => generate(r)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
                      <p className="text-sm font-bold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.category}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="flex flex-col justify-between">
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 mb-4 w-fit"><Activity size={20} /></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Reports Generated</p>
          <p className="text-3xl font-bold text-slate-900 font-display">{genCount}</p>
        </Card>
        <Card className="flex flex-col justify-between">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600 mb-4 w-fit"><Users size={20} /></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">HR & People</p>
          <p className="text-3xl font-bold text-slate-900 font-display">{countIn('HR & People')}</p>
        </Card>
        <Card className="flex flex-col justify-between">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-600 mb-4 w-fit"><Clock size={20} /></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Time & Attendance</p>
          <p className="text-3xl font-bold text-slate-900 font-display">{countIn('Time & Attendance')}</p>
        </Card>
        <Card className="flex flex-col justify-between">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 mb-4 w-fit"><CheckCircle size={20} /></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Financial</p>
          <p className="text-3xl font-bold text-slate-900 font-display">{countIn('Financial')}</p>
        </Card>
      </div>

      <Card noPadding className="shadow-premium">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <div className="w-full sm:max-w-md">
            <Input icon={Search} placeholder="Search reports by name or ID..." className="bg-slate-50 border-slate-200" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative">
              <Button variant="secondary" onClick={() => setShowCategory(v => !v)} className="gap-2 w-full sm:w-auto">
                <Filter size={16} /> <span className="hidden sm:inline">{categoryFilter === 'All' ? 'Category' : categoryFilter}</span>
              </Button>
              {showCategory && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCategory(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => { setCategoryFilter(cat); setShowCategory(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${categoryFilter === cat ? 'text-primary-600 font-bold' : 'text-slate-600'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          {visible.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">No reports match your search.</div>
          ) : (
            <table className="w-full text-left whitespace-nowrap min-w-[700px]">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100">Report Name</th>
                  <th className="px-6 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100">Category</th>
                  <th className="px-6 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100">Description</th>
                  <th className="px-6 py-4 font-bold text-slate-600 uppercase text-xs tracking-wider border-b border-slate-100 text-right">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm leading-tight">{r.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="default" className="bg-slate-100 font-medium">{r.category}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500 whitespace-normal max-w-md">{r.desc}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => generate(r)} disabled={busy === r.id}
                        className="text-primary-600 hover:text-primary-800 bg-primary-50 px-3 py-1.5 rounded-lg flex items-center justify-center ml-auto gap-2 transition-colors font-bold text-xs border border-primary-200 hover:bg-primary-100 disabled:opacity-50">
                        <DownloadCloud size={16} /> {busy === r.id ? 'Exporting…' : 'Download CSV'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Reports;
