import React, { useState, useEffect } from 'react';
import {
  Download, Search, TrendingUp,
  Calendar as CalendarIcon, IndianRupee, DollarSign, Euro,
  Users, FileText, Settings, Plus, Edit,
  Trash2, CheckCircle, AlertCircle, X, Upload,
  Building, Eye, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import api from '../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_MAP = {
  PROCESSED: { label: 'Processed', variant: 'primary' },
  PAID:      { label: 'Paid',      variant: 'success' },
  DRAFT:     { label: 'Draft',     variant: 'warning' },
  HOLD:      { label: 'On Hold',   variant: 'default' },
};

// ─── Salary Slip Print Component ────────────────────────────────────────────
const SalarySlip = ({ data, company, formatCurrency, currencyConfig }) => {
  if (!data) return null;
  const monthName = MONTHS[(data.month || 1) - 1];
  const gross = parseFloat(data.gross_salary) || 0;
  const net   = parseFloat(data.net_salary) || 0;

  const earning = [
    { label: 'Basic Pay',          value: data.basic_pay },
    { label: 'HRA',                value: data.hra },
    { label: 'Dearness Allowance', value: data.da },
    { label: 'Conveyance',         value: data.conveyance },
    { label: 'Medical',            value: data.medical },
    { label: 'Special Allowance',  value: data.special_allowance },
    { label: 'Bonus',              value: data.bonus },
  ].filter(e => parseFloat(e.value) > 0);

  const deduction = [
    { label: 'Provident Fund (12%)',  value: data.pf },
    { label: 'ESI',                   value: data.esi },
    { label: 'Professional Tax',      value: data.professional_tax },
    { label: 'TDS',                   value: data.tds },
    ...(data.customDeductions || []).map(cd => ({ label: cd.label, value: cd.amount })),
  ].filter(d => parseFloat(d.value) > 0);

  return (
    <div id="salary-slip-print" className="bg-white p-8 font-sans text-sm max-w-3xl mx-auto border border-slate-200 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary-600 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white font-black text-xl">D</div>
            <h1 className="text-2xl font-black text-slate-900">DeskTrack</h1>
          </div>
          <p className="text-xs text-slate-500 ml-13">{company || 'Creative Frenzy'}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-800">Salary Slip</p>
          <p className="text-xs text-slate-500">{monthName} {data.year}</p>
          <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 mb-5 text-xs">
        <div className="space-y-1.5">
          <div className="flex gap-2"><span className="text-slate-400 w-28">Employee Name</span><span className="font-bold text-slate-800">: {data.first_name} {data.last_name}</span></div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Employee ID</span><span className="font-bold text-slate-800">: {data.employee_code}</span></div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Designation</span><span className="font-bold text-slate-800">: {data.designation_name || '—'}</span></div>
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2"><span className="text-slate-400 w-28">Department</span><span className="font-bold text-slate-800">: {data.department_name || '—'}</span></div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Pay Period</span><span className="font-bold text-slate-800">: {monthName} {data.year}</span></div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Currency</span><span className="font-bold text-slate-800">: {currencyConfig?.code || 'INR'}</span></div>
        </div>
      </div>

      {/* Attendance Summary */}
      {(data.total_working_days > 0 || data.payable_days > 0) && (
        <div className="mb-5">
          <div className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-t-lg">ATTENDANCE SUMMARY</div>
          <div className="border border-t-0 border-slate-200 rounded-b-lg p-3 bg-slate-50">
            <div className="grid grid-cols-7 gap-2 text-[11px]">
              <div className="text-center"><p className="text-slate-400">Working</p><p className="font-bold text-slate-800">{data.total_working_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Present</p><p className="font-bold text-emerald-700">{data.present_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Half Day</p><p className="font-bold text-amber-700">{data.half_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Absent</p><p className="font-bold text-red-700">{data.absent_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Paid Leave</p><p className="font-bold text-blue-700">{data.paid_leave_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Unpaid</p><p className="font-bold text-rose-700">{data.unpaid_leave_days || 0}</p></div>
              <div className="text-center"><p className="text-slate-400">Payable</p><p className="font-bold text-primary-700">{data.payable_days || 0}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Earnings & Deductions */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-t-lg">EARNINGS</div>
          <table className="w-full text-xs border border-t-0 border-slate-200 rounded-b-lg overflow-hidden">
            <tbody>
              {earning.map((e, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-slate-600">{e.label}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(e.value)}</td>
                </tr>
              ))}
              <tr className="bg-emerald-50 font-bold border-t border-emerald-200">
                <td className="px-4 py-2 text-emerald-800">Gross Salary</td>
                <td className="px-4 py-2 text-right text-emerald-800">{formatCurrency(gross)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-t-lg">DEDUCTIONS</div>
          <table className="w-full text-xs border border-t-0 border-slate-200 rounded-b-lg overflow-hidden">
            <tbody>
              {deduction.map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-slate-600">{d.label}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">{formatCurrency(d.value)}</td>
                </tr>
              ))}
              <tr className="bg-red-50 font-bold border-t border-red-200">
                <td className="px-4 py-2 text-red-800">Total Deductions</td>
                <td className="px-4 py-2 text-right text-red-800">{formatCurrency(data.total_deductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay */}
      <div className="bg-primary-600 text-white rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="text-xs opacity-75 font-medium uppercase tracking-wider">Net Pay (Take Home)</p>
          <p className="text-2xl font-black mt-0.5">{formatCurrency(net)}</p>
        </div>
        <div className="text-right text-xs opacity-75">
          <p>In Words:</p>
          <p className="font-semibold">{numberToWords(Math.round(net))} {currencyConfig?.code || 'INR'} Only</p>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-4">This is a computer-generated payslip and does not require a signature.</p>
    </div>
  );
};

// Simple number-to-words for amounts
function numberToWords(n) {
  if (n === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(num) {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' '+ones[num%10] : '');
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' '+convert(num%100) : '');
    if (num < 100000) return convert(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' '+convert(num%1000) : '');
    if (num < 10000000) return convert(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' '+convert(num%100000) : '');
    return convert(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' '+convert(num%10000000) : '');
  }
  return convert(n);
}

// ─── Main Component ──────────────────────────────────────────────────────────
const Payroll = () => {
  const { user, selectedDate, formatCurrency, currencyConfig, hasPermission, deductionTypes: globalDeductionTypes } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';
  const now = new Date(selectedDate);
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(now.getFullYear());

  const CurrencyIcon = currencyConfig?.code === 'INR' ? IndianRupee
    : currencyConfig?.code === 'EUR' ? Euro : DollarSign;

  // Data
  const [summary,        setSummary]        = useState({});
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [form16List,     setForm16List]     = useState([]);
  const [loading,        setLoading]        = useState(false);

  // UI
  const [activeTab,      setActiveTab]      = useState('payroll');
  const [search,         setSearch]         = useState('');
  const [showRunModal,   setShowRunModal]   = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showSlipModal,  setShowSlipModal]  = useState(false);
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [showForm16Modal, setShowForm16Modal] = useState(false);
  const [viewForm16,      setViewForm16]      = useState(null);
  const [form16Tab,       setForm16Tab]       = useState('A');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [slipData,       setSlipData]       = useState(null);
  const [salaryForm,     setSalaryForm]     = useState({});
  const [editForm,       setEditForm]       = useState({});
  const [form16Form,     setForm16Form]     = useState({ employee_id: '', financial_year: '2024-25' });
  const [submitting,     setSubmitting]     = useState(false);
  const DEFAULT_SLABS = {
    new: [
      { from: 0,       to: 300000,  rate: 0 },
      { from: 300000,  to: 700000,  rate: 5 },
      { from: 700000,  to: 1000000, rate: 10 },
      { from: 1000000, to: 1200000, rate: 15 },
      { from: 1200000, to: 1500000, rate: 20 },
      { from: 1500000, to: null,    rate: 30 },
    ],
    old: [
      { from: 0,      to: 250000,  rate: 0 },
      { from: 250000, to: 500000,  rate: 5 },
      { from: 500000, to: 1000000, rate: 20 },
      { from: 1000000,to: null,    rate: 30 },
    ],
  };
  const DEFAULT_TAX_DECL = () => ({
    regime: 'new', fy: '2025-26',
    stdDeductionNew: 75000, stdDeductionOld: 50000, cessRate: 4,
    slabs: JSON.parse(JSON.stringify(DEFAULT_SLABS)),
    sec80C: 0, sec80D: 0, sec80G: 0, sec80E: 0, hra_claimed: 0, lta: 0, nps: 0, other: 0,
    submitted: false,
  });
  // per-employee declarations keyed by employee_id
  const [taxDeclMap,     setTaxDeclMap]     = useState({});
  const [taxDeclEmpId,   setTaxDeclEmpId]   = useState(null);
  const [selectedEmpsForRun, setSelectedEmpsForRun] = useState({});
  const [editingSlabs,   setEditingSlabs]   = useState(false);

  // helpers
  const getTaxDecl = (empId) => taxDeclMap[empId] || DEFAULT_TAX_DECL();
  const setTaxDecl = (empId, updater) =>
    setTaxDeclMap(prev => ({ ...prev, [empId]: typeof updater === 'function' ? updater(getTaxDecl(empId)) : updater }));

  // Save tax declaration to backend
  // silent=true for auto-save (no alert on failure), false for explicit submit
  const saveTaxDecl = async (empId, decl, silent = true) => {
    if (!empId) {
      if (!silent) alert('Employee ID missing. Please reopen.');
      return false;
    }
    try {
      const res = await api.post(`/payroll/tax-declarations/${empId}`, {
        financial_year: decl.fy,
        regime: decl.regime,
        stdDeductionNew: parseFloat(decl.stdDeductionNew) || 0,
        stdDeductionOld: parseFloat(decl.stdDeductionOld) || 0,
        cessRate: parseFloat(decl.cessRate) || 4,
        slabs: decl.slabs,
        sec80C: parseFloat(decl.sec80C) || 0,
        sec80D: parseFloat(decl.sec80D) || 0,
        sec80G: parseFloat(decl.sec80G) || 0,
        sec80E: parseFloat(decl.sec80E) || 0,
        hra_claimed: parseFloat(decl.hra_claimed) || 0,
        lta: parseFloat(decl.lta) || 0,
        nps: parseFloat(decl.nps) || 0,
        other: parseFloat(decl.other) || 0,
        submitted: !!decl.submitted,
      });
      console.log('[Payroll] Tax declaration saved:', res.data);
      return true;
    } catch (err) {
      console.error('[Payroll] Save tax declaration failed:', err);
      if (!silent) alert(err.response?.data?.error || err.message || 'Failed to save tax declaration');
      return false;
    }
  };

  const isAdmin = hasPermission('payroll', 'edit');

  const currentMonthLabel = `${MONTHS[selMonth - 1]} ${selYear}`;

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, recRes, empRes, ssRes, f16Res, tdRes] = await Promise.all([
        api.get(`/payroll/summary?month=${selMonth}&year=${selYear}`).catch(() => ({ data: {} })),
        api.get(`/payroll?month=${selMonth}&year=${selYear}`).catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/payroll/salary-structures').catch(() => ({ data: [] })),
        api.get('/payroll/form16').catch(() => ({ data: [] })),
        api.get('/payroll/tax-declarations').catch(() => ({ data: [] })),
      ]);
      const allEmps = empRes.data || [];
      const myEmp = isEmployee ? allEmps.find(e => e.email === user?.email) : null;
      const myEmpId = myEmp?.id;

      setSummary(sumRes.data || {});
      // EMPLOYEE: filter to only their own data
      if (isEmployee && myEmpId) {
        setPayrollRecords((recRes.data || []).filter(r => r.employee_id === myEmpId));
        setEmployees([myEmp]);
        setSalaryStructures((ssRes.data || []).filter(s => s.employee_id === myEmpId));
        setForm16List((f16Res.data || []).filter(f => f.employee_id === myEmpId));
      } else {
        setPayrollRecords(recRes.data || []);
        setEmployees(allEmps);
        setSalaryStructures(ssRes.data || []);
        setForm16List(f16Res.data || []);
      }
      // Merge persisted tax declarations into taxDeclMap (DB wins over local default)
      const tdList = tdRes.data || [];
      if (tdList.length > 0) {
        setTaxDeclMap(prev => {
          const merged = { ...prev };
          tdList.forEach(td => {
            const slabs = typeof td.slabs_json === 'string' ? JSON.parse(td.slabs_json || '{}') : (td.slabs_json || {});
            merged[td.employee_id] = {
              regime: td.regime || 'new',
              fy: td.financial_year || '2025-26',
              stdDeductionNew: parseFloat(td.std_deduction_new) || 75000,
              stdDeductionOld: parseFloat(td.std_deduction_old) || 50000,
              cessRate: parseFloat(td.cess_rate) || 4,
              slabs: (slabs.new && slabs.old) ? slabs : JSON.parse(JSON.stringify(DEFAULT_SLABS)),
              sec80C: parseFloat(td.sec80c) || 0,
              sec80D: parseFloat(td.sec80d) || 0,
              sec80G: parseFloat(td.sec80g) || 0,
              sec80E: parseFloat(td.sec80e) || 0,
              hra_claimed: parseFloat(td.hra_claimed) || 0,
              lta: parseFloat(td.lta) || 0,
              nps: parseFloat(td.nps) || 0,
              other: parseFloat(td.other_deductions) || 0,
              submitted: td.submitted || false,
            };
          });
          return merged;
        });
      }
    } catch (err) {
      console.error('Payroll fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [selMonth, selYear]);

  // ── Run Payroll ──────────────────────────────────────────────────────────
  const openRunModal = () => {
    // Pre-select all employees with salary structures
    const initialSelection = {};
    employees.forEach(emp => {
      const hasStructure = salaryStructures.some(s => s.employee_id === emp.id);
      if (hasStructure) initialSelection[emp.id] = true;
    });
    setSelectedEmpsForRun(initialSelection);
    setShowRunModal(true);
  };

  const handleRunPayroll = async () => {
    const selectedIds = Object.keys(selectedEmpsForRun).filter(id => selectedEmpsForRun[id]).map(id => parseInt(id));
    if (selectedIds.length === 0) {
      alert('Please select at least one employee to process payroll.');
      return;
    }
    const force = payrollRecords.length > 0;
    if (force && !window.confirm(`Re-run payroll for ${selectedIds.length} employee(s) for ${currentMonthLabel}? This will delete existing records and re-calculate with current salary structures & attendance.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/payroll/run', {
        month: selMonth,
        year: selYear,
        force,
        employee_ids: selectedIds
      });
      console.log('[Payroll] Run result:', res.data);
      await fetchAll();
      setShowRunModal(false);
      if (res.data?.message) alert(res.data.message);
    } catch (err) {
      console.error('[Payroll] Run error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to run payroll');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Salary Structure ─────────────────────────────────────────────────────
  const openSalaryModal = (emp) => {
    const existing = salaryStructures.find(s => s.employee_id === emp.id);
    // Parse saved deductions_json if available
    let savedDeductions = null, savedCustomDeductions = null;
    if (existing?.deductions_json) {
      try {
        const parsed = typeof existing.deductions_json === 'string'
          ? JSON.parse(existing.deductions_json) : existing.deductions_json;
        savedDeductions = parsed.deductions || null;
        savedCustomDeductions = parsed.customDeductions || null;
      } catch (_) {}
    }
    // Load global deduction type templates from Settings (Salary Slip Fields)
    const globalTypes = globalDeductionTypes || [];
    // Merge: keep saved values for existing fields, add any new fields from Settings
    const mergedCustom = globalTypes.map(t => {
      const saved = (savedCustomDeductions || []).find(s => s.label === t.name);
      return saved
        ? { ...saved, category: t.category || saved.category || 'deduction' }
        : { id: Date.now() + Math.random(), label: t.name, type: t.type, category: t.category || 'deduction', value: t.defaultValue || 0 };
    });

    setSalaryForm({
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      basic_pay: existing?.basic_pay || '',
      hra: existing?.hra || '',
      da: existing?.da || '',
      conveyance: existing?.conveyance || '',
      medical: existing?.medical || '',
      special_allowance: existing?.special_allowance || '',
      effective_from: existing?.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0],
      deductions: savedDeductions || {
        pf:      { enabled: true,  type: 'percent', value: 12,  label: 'Provident Fund',    base: 'basic' },
        esi:     { enabled: true,  type: 'percent', value: 0.75, label: 'ESI',              base: 'gross', condition: 'gross_lt_21000' },
        pt:      { enabled: true,  type: 'fixed',   value: 200, label: 'Professional Tax',  base: null },
        tds:     { enabled: false, type: 'fixed',   value: 0,   label: 'TDS',               base: null },
      },
      customDeductions: mergedCustom,
    });
    setShowSalaryModal(true);
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!salaryForm.employeeId) {
      alert('Employee ID missing. Please reopen the modal.');
      return;
    }
    if (!salaryForm.basic_pay || parseFloat(salaryForm.basic_pay) <= 0) {
      alert('Basic Pay is required and must be greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...salaryForm,
        basic_pay: parseFloat(salaryForm.basic_pay) || 0,
        hra: parseFloat(salaryForm.hra) || 0,
        da: parseFloat(salaryForm.da) || 0,
        conveyance: parseFloat(salaryForm.conveyance) || 0,
        medical: parseFloat(salaryForm.medical) || 0,
        special_allowance: parseFloat(salaryForm.special_allowance) || 0,
      };
      const res = await api.post(`/payroll/salary-structures/${salaryForm.employeeId}`, payload);
      console.log('[Payroll] Salary saved:', res.data);
      await fetchAll();
      setShowSalaryModal(false);
    } catch (err) {
      console.error('[Payroll] Save error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save salary structure');
    } finally {
      setSubmitting(false);
    }
  };

  // ── View / Download Payslip ──────────────────────────────────────────────
  const handleViewSlip = async (record) => {
    try {
      const res = await api.get(`/payroll/${record.id}/payslip`);
      setSlipData(res.data);
      setShowSlipModal(true);
    } catch (err) {
      alert('Failed to load payslip');
    }
  };

  const handlePrintSlip = () => {
    const content = document.getElementById('salary-slip-print');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Salary Slip</title>
      <style>body{font-family:sans-serif;margin:0;padding:20px}table{width:100%;border-collapse:collapse}td{padding:6px 12px}
      .bg-primary{background:#6d28d9;color:white}.bg-emerald{background:#059669;color:white}.bg-red{background:#ef4444;color:white}
      </style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  // ── Edit Payroll Record ──────────────────────────────────────────────────
  const openEditModal = (record) => {
    setSelectedRecord(record);
    setEditForm({
      basic_pay: record.basic_pay, hra: record.hra, da: record.da,
      conveyance: record.conveyance, medical: record.medical,
      special_allowance: record.special_allowance, bonus: record.bonus || 0,
      tds: record.tds || 0, status: record.status,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedRecord?.id) { alert('No payroll record selected.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...editForm,
        basic_pay: parseFloat(editForm.basic_pay) || 0,
        hra: parseFloat(editForm.hra) || 0,
        da: parseFloat(editForm.da) || 0,
        conveyance: parseFloat(editForm.conveyance) || 0,
        medical: parseFloat(editForm.medical) || 0,
        special_allowance: parseFloat(editForm.special_allowance) || 0,
        bonus: parseFloat(editForm.bonus) || 0,
        tds: parseFloat(editForm.tds) || 0,
      };
      const res = await api.put(`/payroll/${selectedRecord.id}`, payload);
      console.log('[Payroll] Record updated:', res.data);
      await fetchAll();
      setShowEditModal(false);
    } catch (err) {
      console.error('[Payroll] Update error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to update payroll record');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Form 16 ──────────────────────────────────────────────────────────────
  const handleUploadForm16 = async (e) => {
    e.preventDefault();
    if (!form16Form.employee_id) { alert('Please select an employee.'); return; }
    if (!form16Form.financial_year) { alert('Financial year is required.'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/payroll/form16', {
        employee_id: form16Form.employee_id,
        financial_year: form16Form.financial_year,
        metadata: { file_name: `Form16_${form16Form.financial_year}_${form16Form.employee_id}.pdf`, uploaded_at: new Date().toISOString() }
      });
      console.log('[Payroll] Form 16 uploaded:', res.data);
      await fetchAll();
      setShowForm16Modal(false);
      setForm16Form({ employee_id: '', financial_year: '2024-25' });
    } catch (err) {
      console.error('[Payroll] Form 16 upload error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to upload Form 16');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteForm16 = async (id) => {
    if (!window.confirm('Delete this Form 16 record?')) return;
    try {
      await api.delete(`/payroll/form16/${id}`);
      await fetchAll();
    } catch (err) {
      alert('Failed to delete Form 16');
    }
  };

  // ── Salary structure auto-calc preview (respects deduction config) ───────
  const customEarnings = (salaryForm.customDeductions || []).filter(cd => cd.category === 'earning');
  const customDeductions = (salaryForm.customDeductions || []).filter(cd => cd.category !== 'earning');

  const calcPreview = () => {
    const basic = parseFloat(salaryForm.basic_pay) || 0;
    const baseGross = basic + (parseFloat(salaryForm.hra)||0) + (parseFloat(salaryForm.da)||0)
      + (parseFloat(salaryForm.conveyance)||0) + (parseFloat(salaryForm.medical)||0)
      + (parseFloat(salaryForm.special_allowance)||0);
    // Add custom earnings to gross
    const customEarnTotal = customEarnings.reduce((sum, cd) =>
      sum + (cd.type === 'percent' ? Math.round(baseGross * (parseFloat(cd.value)||0) / 100) : (parseFloat(cd.value)||0)), 0);
    const gross = baseGross + customEarnTotal;
    const dc = salaryForm.deductions || {};
    const calcDed = (key) => {
      const d = dc[key]; if (!d || !d.enabled) return 0;
      const base = d.base === 'basic' ? basic : gross;
      if (d.condition === 'gross_lt_21000' && gross >= 21000) return 0;
      return d.type === 'percent' ? Math.round(base * (parseFloat(d.value)||0) / 100) : (parseFloat(d.value)||0);
    };
    const breakdown = Object.keys(dc).reduce((acc, k) => ({ ...acc, [k]: calcDed(k) }), {});
    const totalDed = Object.values(breakdown).reduce((a, b) => a + b, 0);
    // Add custom deductions
    const customDedTotal = customDeductions.reduce((sum, cd) =>
      sum + (cd.type === 'percent' ? Math.round(gross * (parseFloat(cd.value)||0) / 100) : (parseFloat(cd.value)||0)), 0);
    return { gross, breakdown, deductions: totalDed + customDedTotal, net: gross - totalDed - customDedTotal };
  };

  const preview = calcPreview();

  const employeesWithoutStructure = employees.filter(
    e => !salaryStructures.find(s => s.employee_id === e.id)
  );

  const YEAR_OPTIONS = [2023, 2024, 2025, 2026];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-display tracking-tight">Payroll & Salary</h2>
          <p className="text-slate-500 font-medium text-sm">Manage employee compensation, salary slips and tax forms.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month picker */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 text-sm">
            <CalendarIcon size={15} className="text-primary-500 mr-1" />
            <select value={selMonth} onChange={e => setSelMonth(+e.target.value)} className="bg-transparent border-none outline-none text-slate-700 font-medium cursor-pointer">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={selYear} onChange={e => setSelYear(+e.target.value)} className="bg-transparent border-none outline-none text-slate-700 font-medium cursor-pointer ml-1">
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {isAdmin && (
            <Button
              onClick={openRunModal}
              className="gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 h-[42px]"
            >
              <CurrencyIcon size={18} />
              {payrollRecords.length > 0 ? 'Re-run Payroll' : 'Run Payroll'}
            </Button>
          )}
        </div>
      </header>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Payout', value: formatCurrency(summary.total_payout || 0), icon: CurrencyIcon, color: 'emerald', sub: `${summary.employee_count || 0} employees` },
          { label: 'Gross Salary', value: formatCurrency(summary.total_gross || 0), icon: TrendingUp, color: 'primary', sub: currentMonthLabel },
          { label: 'Total Deductions', value: formatCurrency(summary.total_deductions || 0), icon: AlertCircle, color: 'red', sub: `PF + ESI + PT + TDS` },
          { label: 'Avg Net Salary', value: formatCurrency(summary.avg_salary || 0), icon: Users, color: 'blue', sub: 'Per employee' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
              <div className={`p-2 rounded-lg bg-${color}-100 text-${color}-600`}><Icon size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900 font-display">{value}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">{sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Statutory summary ── */}
      {(summary.total_pf > 0 || summary.total_esi > 0 || summary.total_tds > 0) && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Provident Fund (12%)", value: summary.total_pf,  color: 'violet' },
            { label: "ESI (0.75%)",          value: summary.total_esi, color: 'blue' },
            { label: "TDS",                  value: summary.total_tds, color: 'orange' },
          ].map(s => (
            <Card key={s.label} className="py-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(s.value || 0)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { key: 'payroll',     label: 'Payroll Records',   icon: FileText },
          { key: 'salary',      label: 'Salary Structure',  icon: Settings },
          { key: 'taxdecl',     label: 'Tax Declaration',   icon: CheckCircle },
          { key: 'downloads',   label: 'Downloads',         icon: Download },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ══ TAB: Payroll Records ══ */}
      {activeTab === 'payroll' && (
        <Card noPadding className="shadow-premium">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Payroll — {currentMonthLabel}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {payrollRecords.length} of {employees.length} employees processed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input icon={Search} placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-50 max-w-xs" />
              <Button variant="secondary" size="sm" onClick={fetchAll} className="gap-2">
                <RefreshCw size={14} /> Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">Loading payroll data…</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {employees
                .filter(emp => !search || `${emp.first_name} ${emp.last_name} ${emp.employee_code}`.toLowerCase().includes(search.toLowerCase()))
                .map(emp => {
                  const r   = payrollRecords.find(p => p.employee_id == emp.id);
                  const ss  = salaryStructures.find(s => s.employee_id == emp.id);
                  const st  = r ? (STATUS_MAP[r.status] || STATUS_MAP.DRAFT) : null;
                  return (
                    <div key={emp.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        {/* Left — employee info */}
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${r ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {(emp.first_name||'?')[0]}{(emp.last_name||'?')[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{emp.first_name} {emp.last_name}</p>
                            <p className="text-xs text-slate-500">{emp.employee_code} · {emp.designation_name || emp.department_name || 'Employee'}</p>
                          </div>
                        </div>
                        {/* Right — actions */}
                        <div className="flex items-center gap-3">
                          {r ? (
                            <>
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <button onClick={() => handleViewSlip(r)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors">
                                <Eye size={13}/> Payslip
                              </button>
                              {isAdmin && (
                                <button onClick={() => openEditModal(r)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                                  <Edit size={15}/>
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
                              {ss ? 'Not Processed' : 'No Salary Structure'}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Detail row */}
                      {r ? (
                        <div className="mt-3 ml-14 flex flex-wrap gap-5 text-xs text-slate-500">
                          <span>Basic: <strong className="text-slate-700">{formatCurrency(r.basic_pay)}</strong></span>
                          <span>HRA: <strong className="text-slate-700">{formatCurrency(r.hra)}</strong></span>
                          <span>DA: <strong className="text-slate-700">{formatCurrency(r.da)}</strong></span>
                          <span>Gross: <strong className="text-emerald-700">{formatCurrency(r.gross_salary)}</strong></span>
                          <span className="text-red-400">PF: <strong>{formatCurrency(r.pf)}</strong></span>
                          <span className="text-red-400">ESI: <strong>{formatCurrency(r.esi)}</strong></span>
                          <span className="text-red-400">PT: <strong>{formatCurrency(r.professional_tax)}</strong></span>
                          <span>Net: <strong className="text-slate-900 text-sm">{formatCurrency(r.net_salary)}</strong></span>
                        </div>
                      ) : ss ? (
                        <div className="mt-3 ml-14 flex flex-wrap gap-5 text-xs text-slate-400">
                          <span>Basic: {formatCurrency(ss.basic_pay)}</span>
                          <span>Gross: {formatCurrency([ss.basic_pay,ss.hra,ss.da,ss.conveyance,ss.medical,ss.special_allowance].reduce((a,b)=>a+(parseFloat(b)||0),0))}</span>
                          <span className="text-amber-500 font-semibold">Payroll not yet run for {currentMonthLabel}</span>
                        </div>
                      ) : (
                        <div className="mt-2 ml-14 text-xs text-slate-400">Set up salary structure to enable payroll processing.</div>
                      )}
                    </div>
                  );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ══ TAB: Salary Structure ══ */}
      {activeTab === 'salary' && (
        <Card noPadding className="shadow-premium">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Salary Structures</h3>
              <p className="text-xs text-slate-500 mt-0.5">Configure CTC components per employee.</p>
            </div>
          </div>

          {employeesWithoutStructure.length > 0 && (
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-800">
                {employeesWithoutStructure.length} employee(s) have no salary structure:&nbsp;
                <span className="font-bold">{employeesWithoutStructure.map(e => `${e.first_name} ${e.last_name}`).join(', ')}</span>
              </p>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {employees.map(emp => {
              const ss = salaryStructures.find(s => s.employee_id === emp.id);
              const gross = ss ? [ss.basic_pay, ss.hra, ss.da, ss.conveyance, ss.medical, ss.special_allowance].reduce((a,b) => a + (parseFloat(b)||0), 0) : 0;
              const basic = parseFloat(ss?.basic_pay) || 0;
              const pf = Math.round(basic * 0.12);
              const esi = gross < 21000 ? Math.round(gross * 0.0075) : 0;
              const net = gross - pf - esi - 200;
              return (
                <div key={emp.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-primary-50/40 transition-colors cursor-pointer group"
                  onClick={() => openSalaryModal(emp)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {(emp.first_name||'?')[0]}{(emp.last_name||'?')[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm group-hover:text-primary-700 transition-colors">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-500">{emp.employee_code} · {emp.designation_name || emp.department_name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    {ss ? (
                      <>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Gross</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(gross)}<span className="text-xs font-medium text-slate-400"> /mo</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Net Pay</p>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(net)}<span className="text-xs font-medium text-slate-400"> /mo</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Basic</p>
                          <p className="text-sm font-semibold text-slate-500">{formatCurrency(basic)}</p>
                        </div>
                      </>
                    ) : (
                      <Badge variant="warning">No Structure</Badge>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant={ss ? 'secondary' : 'primary'}
                        onClick={e => { e.stopPropagation(); openSalaryModal(emp); }}
                        className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {ss ? <><Edit size={13} />Edit</> : <><Plus size={13} />Set Up</>}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ══ TAB: Form 16 ══ */}
      {activeTab === 'form16' && (
        <Card noPadding className="shadow-premium">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Form 16</h3>
              <p className="text-xs text-slate-500 mt-0.5">Annual TDS certificates — Part A, Part B & Declaration.</p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowForm16Modal(true)} className="gap-2">
                <Upload size={14} /> Upload Form 16
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {employees.map(emp => {
              const empRecords = form16List.filter(f => f.employee_id == emp.id);
              const latestRecord = empRecords.sort((a,b) => b.financial_year.localeCompare(a.financial_year))[0];
              const empSS = salaryStructures.find(s => s.employee_id == emp.id);
              const gross = empSS ? [empSS.basic_pay, empSS.hra, empSS.da, empSS.conveyance, empSS.medical, empSS.special_allowance].reduce((a,b) => a + (parseFloat(b)||0), 0) : 0;
              const annualGross = gross * 12;
              const taxDecl = getTaxDecl(emp.id);
              const stdDed = taxDecl.regime === 'new' ? (+taxDecl.stdDeductionNew||0) : (+taxDecl.stdDeductionOld||0);
              const totalDed80C = (+taxDecl.sec80C||0)+(+taxDecl.sec80D||0)+(+taxDecl.sec80G||0)+(+taxDecl.sec80E||0)+(+taxDecl.hra_claimed||0)+(+taxDecl.lta||0)+(+taxDecl.nps||0)+(+taxDecl.other||0);
              const totalDed = taxDecl.regime === 'old' ? stdDed + totalDed80C : stdDed;
              const taxableIncome = Math.max(0, annualGross - totalDed);
              const hasForm16 = empRecords.length > 0;
              return (
                <div key={emp.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${hasForm16 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                        {(emp.first_name||'?')[0]}{(emp.last_name||'?')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-slate-500">{emp.employee_code} · {emp.designation || emp.department || 'Employee'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasForm16 ? (
                        <>
                          <Badge variant="primary">FY {latestRecord.financial_year}</Badge>
                          {['A','B','Declaration'].map(part => (
                            <button key={part} type="button"
                              onClick={() => { setViewForm16(latestRecord); setForm16Tab(part); }}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors">
                              Part {part}
                            </button>
                          ))}
                          <button className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Download">
                            <Download size={15} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDeleteForm16(latestRecord.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">Not Uploaded</span>
                      )}
                    </div>
                  </div>
                  {/* Summary row */}
                  <div className="mt-3 ml-14 flex gap-6 text-xs text-slate-500">
                    <span>Annual Gross: <strong className="text-slate-700">{formatCurrency(annualGross)}</strong></span>
                    <span>Taxable Income: <strong className="text-slate-700">{formatCurrency(taxableIncome)}</strong></span>
                    <span>Regime: <strong className={taxDecl.regime === 'new' ? 'text-blue-600' : 'text-purple-600'}>{taxDecl.regime === 'new' ? 'New' : 'Old'}</strong></span>
                    {empRecords.length > 1 && <span className="text-slate-400">{empRecords.length} records total</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ══ TAB: Tax Declaration — list view ══ */}
      {activeTab === 'taxdecl' && !taxDeclEmpId && (
        <Card noPadding className="shadow-premium">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Tax Declarations</h3>
              <p className="text-xs text-slate-500 mt-0.5">Manage tax regime & investment declarations per employee.</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {employees.map(emp => {
              const d   = getTaxDecl(emp.id);
              const ss  = salaryStructures.find(s => s.employee_id == emp.id);
              const gross = ss ? [ss.basic_pay,ss.hra,ss.da,ss.conveyance,ss.medical,ss.special_allowance].reduce((a,b)=>a+(parseFloat(b)||0),0) : 0;
              const annualGross = gross * 12;
              const stdDed = d.regime === 'new' ? (+d.stdDeductionNew||0) : (+d.stdDeductionOld||0);
              const totalDed80C = (+d.sec80C||0)+(+d.sec80D||0)+(+d.sec80G||0)+(+d.sec80E||0)+(+d.hra_claimed||0)+(+d.lta||0)+(+d.nps||0)+(+d.other||0);
              const totalDed = d.regime === 'old' ? stdDed + totalDed80C : stdDed;
              const taxableIncome = Math.max(0, annualGross - totalDed);
              return (
                <div key={emp.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-primary-50/40 transition-colors cursor-pointer group"
                  onClick={() => setTaxDeclEmpId(emp.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {(emp.first_name||'?')[0]}{(emp.last_name||'?')[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm group-hover:text-primary-700 transition-colors">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-500">{emp.employee_code} · {emp.designation_name || emp.department_name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Regime</p>
                      <p className="text-sm font-bold text-slate-700">{d.regime === 'new' ? 'New Regime' : 'Old Regime'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">FY</p>
                      <p className="text-sm font-semibold text-slate-600">{d.fy}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Taxable Income</p>
                      <p className="text-sm font-bold text-orange-600">{formatCurrency(taxableIncome)}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${d.submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.submitted ? '✓ Submitted' : 'Pending'}
                    </span>
                    <Button size="sm" variant="secondary"
                      onClick={e => { e.stopPropagation(); setTaxDeclEmpId(emp.id); }}
                      className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit size={13}/>{d.submitted ? 'Edit' : 'Fill'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ══ TAB: Tax Declaration — edit view ══ */}
      {activeTab === 'taxdecl' && taxDeclEmpId && (() => {
        const selEmpId = taxDeclEmpId;
        const taxDecl  = getTaxDecl(selEmpId);
        const td       = (updater) => setTaxDecl(selEmpId, updater);
        const empSS    = salaryStructures.find(s => s.employee_id == selEmpId);
        const gross    = empSS ? [empSS.basic_pay,empSS.hra,empSS.da,empSS.conveyance,empSS.medical,empSS.special_allowance].reduce((a,b)=>a+(parseFloat(b)||0),0) : 0;
        const annualGross = gross * 12;
        const stdDed = taxDecl.regime === 'new' ? (+taxDecl.stdDeductionNew||0) : (+taxDecl.stdDeductionOld||0);
        const totalDed = taxDecl.regime === 'old'
          ? stdDed + (+taxDecl.sec80C||0) + (+taxDecl.sec80D||0) + (+taxDecl.sec80G||0) + (+taxDecl.sec80E||0) + (+taxDecl.hra_claimed||0) + (+taxDecl.lta||0) + (+taxDecl.nps||0) + (+taxDecl.other||0)
          : stdDed;
        const taxableIncome = Math.max(0, annualGross - totalDed);
        const calcTaxFromSlabs = (income, slabs) => {
          let tax = 0;
          const sorted = [...slabs].sort((a,b) => a.from - b.from);
          for (const slab of sorted) {
            if (income <= slab.from) break;
            const upper = slab.to === null ? income : Math.min(income, slab.to);
            tax += Math.round((upper - slab.from) * (slab.rate / 100));
          }
          return tax;
        };
        const taxSlab    = calcTaxFromSlabs(taxableIncome, taxDecl.slabs[taxDecl.regime]);
        const cess       = Math.round(taxSlab * ((+taxDecl.cessRate||0) / 100));
        const totalTax   = taxSlab + cess;
        const monthlyTDS = Math.round(totalTax / 12);

        const updateSlab = (regime, idx, field, val) => {
          const updated = taxDecl.slabs[regime].map((s,i) => i === idx ? {...s, [field]: val === '' ? null : +val} : s);
          td(p => ({...p, slabs: {...p.slabs, [regime]: updated}}));
        };
        const addSlab = (regime) => {
          const slabs  = taxDecl.slabs[regime];
          const last   = slabs[slabs.length-1];
          const newFrom = last.to || (last.from + 500000);
          td(p => ({...p, slabs: {...p.slabs, [regime]: [...slabs.map((s,i)=> i===slabs.length-1 ? {...s, to: newFrom} : s), {from: newFrom, to: null, rate: 30}]}}));
        };
        const removeSlab = (regime, idx) => {
          if (taxDecl.slabs[regime].length <= 1) return;
          td(p => ({...p, slabs: {...p.slabs, [regime]: p.slabs[regime].filter((_,i)=>i!==idx)}}));
        };

        const selEmp = employees.find(e => e.id == selEmpId);
        return (
          <div className="space-y-6">
            {/* Back bar */}
            <div className="flex items-center gap-3">
              <button onClick={async () => { await saveTaxDecl(selEmpId, taxDecl, true); setTaxDeclEmpId(null); }} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary-700 transition-colors">
                ← Back to all employees
              </button>
              <span className="text-slate-300">|</span>
              <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                {(selEmp?.first_name||'?')[0]}{(selEmp?.last_name||'?')[0]}
              </div>
              <span className="font-bold text-slate-900">{selEmp?.first_name} {selEmp?.last_name}</span>
              <span className="text-xs text-slate-400">{selEmp?.employee_code}</span>
            </div>
            {/* Regime selector + config */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Tax Regime Selection</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Customize slabs for FY {taxDecl.fy} — updated every year</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={taxDecl.fy} onChange={e => td(p=>({...p, fy: e.target.value}))}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50">
                    {['2023-24','2024-25','2025-26','2026-27'].map(y=><option key={y} value={y}>FY {y}</option>)}
                  </select>
                  <button type="button" onClick={() => setEditingSlabs(p=>!p)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${editingSlabs ? 'bg-primary-600 text-white border-primary-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                    <Edit size={13}/> {editingSlabs ? 'Done Editing' : 'Customize Slabs'}
                  </button>
                  {editingSlabs && (
                    <button type="button" onClick={() => td(p=>({...p, slabs: JSON.parse(JSON.stringify(DEFAULT_SLABS))}))}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                      Reset Defaults
                    </button>
                  )}
                </div>
              </div>

              {/* Global settings row */}
              {editingSlabs && (
                <div className="mb-6 flex gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Standard Deduction — New Regime</label>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₹</span>
                      <input type="number" value={+(taxDecl.stdDeductionNew||0)}
                        onChange={e => td(p=>({...p, stdDeductionNew: parseFloat(e.target.value)||0}))}
                        className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-right" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Standard Deduction — Old Regime</label>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₹</span>
                      <input type="number" value={+(taxDecl.stdDeductionOld||0)}
                        onChange={e => td(p=>({...p, stdDeductionOld: parseFloat(e.target.value)||0}))}
                        className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-right" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Health & Education Cess %</label>
                    <div className="relative w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                      <input type="number" value={+(taxDecl.cessRate||0)}
                        onChange={e => td(p=>({...p, cessRate: parseFloat(e.target.value)||0}))}
                        className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-right" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {['new','old'].map(regKey => {
                  const titles = { new: 'New Tax Regime', old: 'Old Tax Regime' };
                  const badges = { new: 'Default', old: 'With Deductions' };
                  const descs  = { new: `No exemptions/deductions. Std deduction ₹${(+taxDecl.stdDeductionNew/1000).toFixed(0)}k.`,
                                   old: `Allows HRA, 80C, 80D etc. Std deduction ₹${(+taxDecl.stdDeductionOld/1000).toFixed(0)}k.` };
                  const slabs  = taxDecl.slabs[regKey];
                  const fmtL = v => v === null ? 'Above' : `₹${(v/100000).toFixed(v%100000===0?0:1)}L`;
                  return (
                    <div key={regKey}
                      className={`rounded-2xl border-2 p-7 transition-all ${taxDecl.regime === regKey ? 'border-primary-500 bg-primary-50 shadow-md' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => !editingSlabs && td(p=>({...p, regime: regKey}))}>
                        <span className={`font-bold text-lg ${taxDecl.regime === regKey ? 'text-primary-700' : 'text-slate-800'}`}>{titles[regKey]}</span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${taxDecl.regime === regKey ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{badges[regKey]}</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">{descs[regKey]}</p>

                      {/* Slab rows */}
                      {editingSlabs ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-1 text-xs font-bold text-slate-400 uppercase px-1">
                            <span>From (₹)</span><span>To (₹, blank=above)</span><span>Rate %</span>
                          </div>
                          {slabs.map((slab, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-1 items-center">
                              <input type="number" value={slab.from} readOnly
                                className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-slate-100 text-right" />
                              <input type="number" value={slab.to ?? ''} placeholder="Above"
                                onChange={e => updateSlab(regKey, idx, 'to', e.target.value)}
                                className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-right focus:ring-1 focus:ring-primary-400" />
                              <div className="flex items-center gap-1">
                                <input type="number" value={slab.rate}
                                  onChange={e => updateSlab(regKey, idx, 'rate', e.target.value)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-right focus:ring-1 focus:ring-primary-400" />
                                <button type="button" onClick={() => removeSlab(regKey, idx)}
                                  className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                  <X size={13}/>
                                </button>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => addSlab(regKey)}
                            className="mt-1 w-full text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-dashed border-primary-300 rounded-lg py-2 transition-colors flex items-center justify-center gap-1">
                            <Plus size={12}/> Add Slab
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {slabs.map((s,i) => (
                            <p key={i} className="text-sm text-slate-600 font-mono">
                              • {s.to ? `${fmtL(s.from)}–${fmtL(s.to)}` : `${fmtL(s.from)}+`}: <strong>{s.rate === 0 ? 'Nil' : `${s.rate}%`}</strong>
                            </p>
                          ))}
                        </div>
                      )}
                      {!editingSlabs && taxDecl.regime === regKey && (
                        <div className="mt-4 flex items-center gap-1.5 text-primary-600 text-sm font-bold">
                          <CheckCircle size={15}/> Selected
                        </div>
                      )}
                      {!editingSlabs && taxDecl.regime !== regKey && (
                        <button type="button" onClick={() => td(p=>({...p, regime: regKey}))}
                          className="mt-4 w-full text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl py-2.5 transition-colors">
                          Select this Regime
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Declarations grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Investment declarations - only for old regime */}
              <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-opacity ${taxDecl.regime === 'new' ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Investment Declarations</p>
                  {taxDecl.regime === 'new' && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Not applicable in New Regime</span>}
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { key:'sec80C',     label:'Section 80C',        sub:'PF, PPF, ELSS, LIC, NSC etc.',  max:150000 },
                    { key:'sec80D',     label:'Section 80D',        sub:'Health Insurance Premium',       max:25000 },
                    { key:'sec80G',     label:'Section 80G',        sub:'Donations to Charity',           max:null },
                    { key:'sec80E',     label:'Section 80E',        sub:'Education Loan Interest',        max:null },
                    { key:'hra_claimed',label:'HRA Exemption',      sub:'Actual HRA received × formula',  max:null },
                    { key:'lta',        label:'LTA',                sub:'Leave Travel Allowance',          max:null },
                    { key:'nps',        label:'NPS (80CCD 1B)',     sub:'National Pension Scheme',         max:50000 },
                    { key:'other',      label:'Other Deductions',   sub:'Any other exemptions',            max:null },
                  ].map(({ key, label, sub, max }) => (
                    <div key={key} className="px-6 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        <p className="text-xs text-slate-400">{sub}{max ? ` (max ₹${(max/1000).toFixed(0)}k)` : ''}</p>
                      </div>
                      <div className="relative w-36 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                        <input type="number" min="0" step="0.01" max={max||undefined} value={+(taxDecl[key]||0)}
                          onChange={e => td(p=>({...p, [key]: parseFloat(e.target.value)||0}))}
                          className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-slate-50 text-right focus:ring-2 focus:ring-primary-500/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax summary */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tax Computation Summary</p>
                  </div>
                  <div className="divide-y divide-slate-100 text-sm">
                    {[
                      ['Annual Gross Salary',   formatCurrency(annualGross),     'text-slate-900'],
                      ['Total Deductions',      `- ${formatCurrency(totalDed)}`, 'text-red-600'],
                      ['Net Taxable Income',    formatCurrency(taxableIncome),   'text-slate-900 font-bold'],
                      ['Tax on Income',         formatCurrency(taxSlab),         'text-orange-600'],
                      ['Health & Education Cess (4%)', formatCurrency(cess),    'text-orange-500'],
                      ['Total Tax Payable',     formatCurrency(totalTax),        'text-red-700 font-black text-base'],
                      ['Monthly TDS',           formatCurrency(monthlyTDS),      'text-primary-700 font-black text-base'],
                    ].map(([label, val, cls]) => (
                      <div key={label} className="px-6 py-3 flex justify-between items-center">
                        <span className="text-slate-500">{label}</span>
                        <span className={cls}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-white text-center shadow-lg">
                  <p className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1">Effective Monthly TDS</p>
                  <p className="text-4xl font-black">{formatCurrency(monthlyTDS)}</p>
                  <p className="text-xs opacity-60 mt-1">Based on {taxDecl.regime === 'new' ? 'New' : 'Old'} Regime · FY {taxDecl.fy}</p>
                </div>

                <button
                  onClick={async () => {
                    const updated = { ...taxDecl, submitted: true };
                    td(() => updated);
                    const ok = await saveTaxDecl(selEmpId, updated, false);
                    if (ok) alert('Tax declaration submitted successfully!');
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
                  <CheckCircle size={16} />
                  {taxDecl.submitted ? 'Declaration Submitted ✓' : 'Submit Tax Declaration'}
                </button>
                {taxDecl.submitted && (
                  <p className="text-xs text-center text-emerald-600 font-semibold">
                    Declaration submitted for FY {taxDecl.fy} · {taxDecl.regime === 'new' ? 'New' : 'Old'} Regime
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ TAB: Downloads ══ */}
      {activeTab === 'downloads' && (
        <div className="space-y-6">
          {/* Payslips */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
                <FileText size={16}/>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Salary Slips</p>
                <p className="text-xs text-slate-400">Monthly payslips for all processed payroll months</p>
              </div>
            </div>
            {payrollRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No payroll records yet. Run payroll first.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payrollRecords.map(r => (
                  <div key={r.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {(r.first_name||'?')[0]}{(r.last_name||'?')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{r.first_name} {r.last_name}</p>
                        <p className="text-xs text-slate-500">{MONTHS[(r.month||1)-1]} {r.year} · Net: {formatCurrency(r.net_pay)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.status === 'paid' ? 'success' : 'warning'}>{r.status || 'processed'}</Badge>
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get(`/payroll/${r.id}/payslip`);
                            setSlipData(res.data);
                            setShowSlipModal(true);
                          } catch { alert('Failed to load payslip'); }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors">
                        <Eye size={13}/> View
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get(`/payroll/${r.id}/payslip`);
                            setSlipData(res.data);
                            setTimeout(() => handlePrintSlip(), 300);
                          } catch { alert('Failed to load payslip'); }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors">
                        <Download size={13}/> Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form 16 downloads */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Building size={16}/>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Form 16 (TDS Certificates)</p>
                <p className="text-xs text-slate-400">Annual tax certificates — Part A, Part B & Declaration</p>
              </div>
            </div>
            {form16List.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No Form 16 records uploaded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {form16List.map(f => (
                  <div key={f.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileText size={15}/>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{f.first_name} {f.last_name}</p>
                        <p className="text-xs text-slate-500">FY {f.financial_year} · {f.employee_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {['A','B','Declaration'].map(part => (
                        <button key={part} onClick={() => { setViewForm16(f); setForm16Tab(part); setActiveTab('form16'); }}
                          className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors">
                          Part {part}
                        </button>
                      ))}
                      <button onClick={() => { setViewForm16(f); setForm16Tab('A'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors ml-1">
                        <Download size={13}/> Download All
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax Declaration download */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <CheckCircle size={16}/>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Tax Declaration</p>
                <p className="text-xs text-slate-400">Investment declaration & regime selection summary</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {employees.map(emp => {
                const d = getTaxDecl(emp.id);
                return (
                  <div key={emp.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {(emp.first_name||'?')[0]}{(emp.last_name||'?')[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-slate-500">FY {d.fy} · {d.regime === 'new' ? 'New Regime' : 'Old Regime'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${d.submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {d.submitted ? '✓ Submitted' : 'Pending'}
                      </span>
                      {d.submitted && (
                        <button onClick={() => { setTaxDeclEmpId(emp.id); setActiveTab('taxdecl'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors">
                          <Download size={13}/> View / Download
                        </button>
                      )}
                      {!d.submitted && (
                        <button onClick={() => { setTaxDeclEmpId(emp.id); setActiveTab('taxdecl'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                          Fill Declaration
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Run Payroll ══ */}
      <Modal isOpen={showRunModal} onClose={() => setShowRunModal(false)} title={`Run Payroll — ${currentMonthLabel}`} maxWidth="max-w-2xl">
        {(() => {
          const selectedCount = Object.values(selectedEmpsForRun).filter(Boolean).length;
          const empsWithStruct = employees.filter(e => salaryStructures.some(s => s.employee_id === e.id));
          const allSelected = empsWithStruct.length > 0 && empsWithStruct.every(e => selectedEmpsForRun[e.id]);
          const toggleAll = () => {
            const next = {};
            if (!allSelected) empsWithStruct.forEach(e => next[e.id] = true);
            setSelectedEmpsForRun(next);
          };
          // Aggregate deduction types from all salary structures
          const deductionLabels = new Map();
          salaryStructures.forEach(ss => {
            try {
              const parsed = typeof ss.deductions_json === 'string' ? JSON.parse(ss.deductions_json || '{}') : (ss.deductions_json || {});
              const deds = parsed.deductions || {};
              Object.entries(deds).forEach(([key, d]) => {
                if (d.enabled) {
                  const desc = d.type === 'percent' ? `${d.value}% of ${d.base || 'gross'}` : `₹${d.value}`;
                  deductionLabels.set(d.label || key, desc);
                }
              });
              (parsed.customDeductions || []).filter(cd => cd.value > 0 && cd.category !== 'earning').forEach(cd => {
                const desc = cd.type === 'percent' ? `${cd.value}%` : `₹${cd.value}`;
                deductionLabels.set(cd.label, desc);
              });
            } catch {}
          });

          return (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <p className="text-emerald-600 text-xs mb-1 font-bold">Selected</p>
                  <p className="font-bold text-emerald-900 text-lg">{selectedCount}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-500 text-xs mb-1 font-bold">With Structure</p>
                  <p className="font-bold text-slate-900 text-lg">{empsWithStruct.length}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="text-amber-600 text-xs mb-1 font-bold">No Structure</p>
                  <p className="font-bold text-amber-700 text-lg">{employeesWithoutStructure.length}</p>
                </div>
              </div>

              {/* Employee Selection */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Employees</span>
                  </label>
                  <span className="text-xs text-slate-400">{selectedCount} of {empsWithStruct.length} selected</span>
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                  {empsWithStruct.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No employees with salary structure. Please set up structures first.</div>
                  ) : empsWithStruct.map(emp => {
                    const ss = salaryStructures.find(s => s.employee_id === emp.id);
                    const gross = [ss?.basic_pay, ss?.hra, ss?.da, ss?.conveyance, ss?.medical, ss?.special_allowance].reduce((a, b) => a + (parseFloat(b) || 0), 0);
                    return (
                      <label key={emp.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox"
                          checked={!!selectedEmpsForRun[emp.id]}
                          onChange={() => setSelectedEmpsForRun(p => ({ ...p, [emp.id]: !p[emp.id] }))}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold">
                          {(emp.first_name || '?')[0]}{(emp.last_name || '?')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-[10px] text-slate-400">{emp.employee_code}</p>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{formatCurrency(gross)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Calculation Rules — dynamic */}
              <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600">
                <p className="font-bold text-slate-700 mb-2">Calculation Rules</p>
                <div className="space-y-1">
                  <p>• <strong>Payable Days</strong> = Present + (0.5 × Half Day) + Paid Leaves</p>
                  <p>• <strong>Earned Gross</strong> = (Full Gross ÷ Working Days) × Payable Days</p>
                  <p>• <strong>LOP</strong> = (Gross ÷ Working Days) × (Absent + Unpaid Leave)</p>
                </div>
                {deductionLabels.size > 0 && (
                  <>
                    <p className="pt-3 font-bold text-slate-700 mb-1">Deductions (from Salary Structures)</p>
                    <div className="space-y-0.5">
                      {[...deductionLabels.entries()].map(([label, desc]) => (
                        <p key={label}>• <strong>{label}</strong>: {desc}</p>
                      ))}
                    </div>
                  </>
                )}
                {deductionLabels.size === 0 && (
                  <p className="pt-2 text-amber-600 italic">No deductions configured in salary structures.</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowRunModal(false)}>Cancel</Button>
                <Button onClick={handleRunPayroll} disabled={submitting || selectedCount === 0} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <CurrencyIcon size={16} />{submitting ? 'Processing…' : `Process ${selectedCount} Employee${selectedCount !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══ FULL-PAGE: Salary Structure ══ */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
          <form onSubmit={handleSaveSalary}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Salary Structure</p>
                <h2 className="text-xl font-bold text-slate-900">{salaryForm.employeeName || ''}</h2>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowSalaryModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Structure'}</Button>
              </div>
            </div>

            {/* Body */}
            <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-2 gap-8">

              {/* LEFT: Earnings */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">Earnings Components</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'basic_pay',         label: 'Basic Pay *' },
                      { key: 'hra',               label: 'HRA' },
                      { key: 'da',                label: 'Dearness Allowance' },
                      { key: 'conveyance',        label: 'Conveyance Allowance' },
                      { key: 'medical',           label: 'Medical Allowance' },
                      { key: 'special_allowance', label: 'Special Allowance' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{currencyConfig?.symbol || '₹'}</span>
                          <input type="number" min="0" step="0.01"
                            required={key === 'basic_pay'}
                            value={salaryForm[key] || ''}
                            onChange={e => setSalaryForm(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Custom Earnings from Settings */}
                  {customEarnings.length > 0 && (
                    <>
                      <div className="border-t border-slate-200 mt-5 pt-5">
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-3">Custom Earnings <span className="text-slate-400 font-medium">(from Settings)</span></p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {customEarnings.map((cd, idx) => {
                          const globalIdx = (salaryForm.customDeductions || []).indexOf(cd);
                          return (
                            <div key={cd.id || idx}>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{cd.label}</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                  {cd.type === 'percent' ? '%' : (currencyConfig?.symbol || '₹')}
                                </span>
                                <input type="number" min="0" step={cd.type === 'percent' ? '0.01' : '1'}
                                  value={+(cd.value||0)}
                                  onChange={e => setSalaryForm(p => ({
                                    ...p,
                                    customDeductions: p.customDeductions.map((x, i) => i === globalIdx ? { ...x, value: parseFloat(e.target.value)||0 } : x)
                                  }))}
                                  className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-green-50/30"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Effective From</p>
                  <input type="date" value={salaryForm.effective_from || ''}
                    onChange={e => setSalaryForm(p => ({ ...p, effective_from: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500/20 bg-slate-50" />
                </div>

                {/* Live preview */}
                <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-4">Monthly Preview</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs opacity-70 mb-1">Gross Earnings</p>
                      <p className="font-bold text-emerald-300 text-2xl">{formatCurrency(preview.gross)}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-70 mb-1">Total Deductions</p>
                      <p className="font-bold text-red-300 text-2xl">{formatCurrency(preview.deductions)}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-70 mb-1">Net Pay</p>
                      <p className="font-black text-white text-2xl">{formatCurrency(preview.net)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Deductions */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Deduction Components</p>
                  <span className="text-[10px] text-slate-400 font-medium">Toggle & customize each deduction</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {salaryForm.deductions && Object.entries(salaryForm.deductions).map(([key, d]) => (
                    <div key={key} className={`flex items-center gap-4 px-6 py-4 transition-colors ${d.enabled ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/30'}`}>
                      {/* Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" className="sr-only peer"
                          checked={d.enabled}
                          onChange={e => setSalaryForm(p => ({ ...p, deductions: { ...p.deductions, [key]: { ...d, enabled: e.target.checked } } }))}
                        />
                        <div className="w-10 h-6 bg-slate-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold ${d.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{d.label}</span>
                        {d.condition === 'gross_lt_21000' && d.enabled && preview.gross >= 21000 && (
                          <p className="text-[10px] font-semibold text-amber-600 mt-0.5">Gross &gt; ₹21,000 — not applicable</p>
                        )}
                      </div>

                      {/* Type toggle */}
                      {d.enabled && (
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
                          {['percent','fixed'].map(t => (
                            <button key={t} type="button"
                              onClick={() => setSalaryForm(p => ({ ...p, deductions: { ...p.deductions, [key]: { ...d, type: t } } }))}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${d.type === t ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                              {t === 'percent' ? '%' : currencyConfig?.symbol || '₹'}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Value input */}
                      {d.enabled ? (
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                            {d.type === 'percent' ? '%' : currencyConfig?.symbol || '₹'}
                          </span>
                          <input type="number" min="0" step={d.type === 'percent' ? '0.01' : '1'}
                            value={d.value}
                            onChange={e => setSalaryForm(p => ({ ...p, deductions: { ...p.deductions, [key]: { ...d, value: e.target.value } } }))}
                            className="w-full pl-7 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-primary-500/20 text-right"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 w-32 text-right shrink-0">—</span>
                      )}

                      {/* Computed amount */}
                      <span className={`text-sm font-bold w-28 text-right shrink-0 ${d.enabled ? 'text-red-500' : 'text-slate-300'}`}>
                        {d.enabled ? formatCurrency(preview.breakdown?.[key] || 0) : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Custom Deductions (from Settings) ── */}
                {customDeductions.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Custom Deductions</p>
                      <span className="text-[10px] text-slate-400 font-medium">Configured in Settings → Payroll</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {customDeductions.map((cd) => {
                        const globalIdx = (salaryForm.customDeductions || []).indexOf(cd);
                        return (
                          <div key={cd.id || globalIdx} className="flex items-center gap-4 px-6 py-4 bg-white hover:bg-slate-50/50">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-slate-800">{cd.label}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">{cd.type === 'percent' ? '% of Gross' : 'Fixed amount'}</p>
                            </div>
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                                {cd.type === 'percent' ? '%' : '₹'}
                              </span>
                              <input type="number" min="0" step={cd.type === 'percent' ? '0.01' : '1'}
                                value={+(cd.value||0)}
                                onChange={e => setSalaryForm(p => ({
                                  ...p,
                                  customDeductions: p.customDeductions.map((x, i) => i === globalIdx ? { ...x, value: parseFloat(e.target.value)||0 } : x)
                                }))}
                                className="w-full pl-7 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-primary-500/20 text-right"
                              />
                            </div>
                            <span className="text-sm font-bold text-red-500 w-28 text-right shrink-0">
                              {formatCurrency(cd.type === 'percent'
                                ? Math.round(preview.gross * (parseFloat(cd.value)||0) / 100)
                                : (parseFloat(cd.value)||0))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Deductions total */}
                <div className="bg-red-50 px-6 py-4 border-t border-red-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-red-700">Total Deductions</span>
                  <span className="text-lg font-black text-red-600">{formatCurrency(preview.deductions)}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ══ MODAL: Edit Payroll Record ══ */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Payroll Record">
        {selectedRecord && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <p className="text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-xl">
              {selectedRecord.first_name} {selectedRecord.last_name} · {MONTHS[selMonth-1]} {selYear}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'basic_pay', label: 'Basic Pay' },
                { key: 'hra',       label: 'HRA' },
                { key: 'da',        label: 'DA' },
                { key: 'conveyance',label: 'Conveyance' },
                { key: 'medical',   label: 'Medical' },
                { key: 'special_allowance', label: 'Special Allowance' },
                { key: 'bonus',     label: 'Bonus' },
                { key: 'tds',       label: 'TDS' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{currencyConfig?.symbol || '₹'}</span>
                    <input type="number" min="0" step="0.01"
                      value={editForm[key] ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500/20 bg-slate-50"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Status</label>
              <select value={editForm.status || 'PROCESSED'}
                onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-primary-500/20">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Update Record'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══ MODAL: Payslip View ══ */}
      <Modal isOpen={showSlipModal} onClose={() => setShowSlipModal(false)} title="Salary Slip" maxWidth="max-w-3xl">
        <div className="space-y-4">
          <SalarySlip data={slipData} formatCurrency={formatCurrency} currencyConfig={currencyConfig} company="Creative Frenzy" />
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setShowSlipModal(false)}>Close</Button>
            <Button onClick={handlePrintSlip} className="gap-2">
              <Download size={16} /> Download / Print
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══ FULL-PAGE: Form 16 Viewer ══ */}
      {viewForm16 && (() => {
        const f = viewForm16;
        const empSS = salaryStructures.find(s => s.employee_id == f.employee_id);
        const gross = empSS ? [empSS.basic_pay, empSS.hra, empSS.da, empSS.conveyance, empSS.medical, empSS.special_allowance].reduce((a,b) => a + (parseFloat(b)||0), 0) : 0;
        const annualGross = gross * 12;
        const basic12 = (parseFloat(empSS?.basic_pay) || 0) * 12;
        const pf12 = Math.round(basic12 * 0.12);
        const stdDeduction = 50000;
        const taxableIncome = Math.max(0, annualGross - stdDeduction);
        return (
          <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Form 16 · FY {f.financial_year}</p>
                <h2 className="text-xl font-bold text-slate-900">{f.first_name} {f.last_name} <span className="text-slate-400 font-normal text-base">· {f.employee_code}</span></h2>
              </div>
              <div className="flex items-center gap-3">
                {['A','B','Declaration'].map(part => (
                  <button key={part} type="button" onClick={() => setForm16Tab(part)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${form16Tab === part ? 'bg-primary-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Part {part}
                  </button>
                ))}
                <button onClick={() => setViewForm16(null)} className="ml-4 p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="max-w-4xl mx-auto px-8 py-8">
              {/* PART A */}
              {form16Tab === 'A' && (
                <div className="space-y-6">
                  <div className="bg-blue-600 text-white rounded-2xl p-6">
                    <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Form 16 · Part A</p>
                    <h3 className="text-lg font-bold mt-1">Certificate of Tax Deducted at Source</h3>
                    <p className="text-xs opacity-60 mt-1">Under Section 203 of the Income Tax Act, 1961</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Employer Details</p>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-4 text-sm">
                      {[
                        ['TAN of Employer', 'MUMA12345B'],
                        ['PAN of Employer', 'AABCC1234D'],
                        ['Name of Employer', 'Creative Frenzy'],
                        ['Address', 'Mumbai, Maharashtra'],
                        ['Financial Year', f.financial_year],
                        ['Assessment Year', f.financial_year.split('-').map((y,i) => i===0 ? (parseInt(y)+1).toString() : (parseInt('20'+y)+1).toString().slice(-2)).join('-')],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">{label}</p>
                          <p className="font-bold text-slate-900">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Employee Details</p>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-4 text-sm">
                      {[
                        ['Name', `${f.first_name} ${f.last_name}`],
                        ['Employee Code', f.employee_code],
                        ['PAN', 'XXXXX0000X'],
                        ['Designation', empSS ? 'Employee' : '—'],
                        ['Period of Employment', `Apr ${f.financial_year.split('-')[0]} – Mar ${f.financial_year.split('-')[0].slice(0,2) + f.financial_year.split('-')[1]}`],
                        ['Email', f.email || '—'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">{label}</p>
                          <p className="font-bold text-slate-900">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quarterly TDS Summary</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>{['Quarter','Period','Amount Paid','TDS Deducted','TDS Deposited'].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[['Q1','Apr – Jun',gross*3],['Q2','Jul – Sep',gross*3],['Q3','Oct – Dec',gross*3],['Q4','Jan – Mar',gross*3]].map(([q,period,amt]) => (
                          <tr key={q} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-bold text-slate-700">{q}</td>
                            <td className="px-6 py-3 text-slate-600">{period}</td>
                            <td className="px-6 py-3 font-semibold">{formatCurrency(amt)}</td>
                            <td className="px-6 py-3 text-blue-700 font-bold">{formatCurrency(0)}</td>
                            <td className="px-6 py-3 text-emerald-700 font-bold">{formatCurrency(0)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                          <td colSpan={2} className="px-6 py-3 font-bold text-slate-900">Total</td>
                          <td className="px-6 py-3">{formatCurrency(annualGross)}</td>
                          <td className="px-6 py-3 text-blue-700">{formatCurrency(0)}</td>
                          <td className="px-6 py-3 text-emerald-700">{formatCurrency(0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PART B */}
              {form16Tab === 'B' && (
                <div className="space-y-6">
                  <div className="bg-emerald-600 text-white rounded-2xl p-6">
                    <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Form 16 · Part B</p>
                    <h3 className="text-lg font-bold mt-1">Details of Salary Paid and Tax Deducted</h3>
                    <p className="text-xs opacity-60 mt-1">Annexure to Part A — Salary Breakup</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gross Salary Breakup (Annual)</p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ['Basic Pay', (parseFloat(empSS?.basic_pay)||0)*12],
                          ['House Rent Allowance (HRA)', (parseFloat(empSS?.hra)||0)*12],
                          ['Dearness Allowance (DA)', (parseFloat(empSS?.da)||0)*12],
                          ['Conveyance Allowance', (parseFloat(empSS?.conveyance)||0)*12],
                          ['Medical Allowance', (parseFloat(empSS?.medical)||0)*12],
                          ['Special Allowance', (parseFloat(empSS?.special_allowance)||0)*12],
                        ].map(([label, val]) => (
                          <tr key={label} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-700">{label}</td>
                            <td className="px-6 py-3 font-bold text-right text-slate-900">{formatCurrency(val)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold">
                          <td className="px-6 py-3 text-emerald-800 font-bold">Gross Total Salary</td>
                          <td className="px-6 py-3 font-black text-right text-emerald-700 text-base">{formatCurrency(annualGross)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Deductions (Chapter VI-A)</p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ['Standard Deduction (u/s 16)', stdDeduction],
                          ['PF Employee Contribution (80C)', pf12],
                          ['Professional Tax (u/s 16(iii))', 200*12],
                        ].map(([label, val]) => (
                          <tr key={label} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-700">{label}</td>
                            <td className="px-6 py-3 font-bold text-right text-red-600">{formatCurrency(val)}</td>
                          </tr>
                        ))}
                        <tr className="bg-red-50 border-t-2 border-red-100">
                          <td className="px-6 py-3 font-bold text-red-700">Total Deductions</td>
                          <td className="px-6 py-3 font-black text-right text-red-600">{formatCurrency(stdDeduction + pf12 + 2400)}</td>
                        </tr>
                        <tr className="bg-primary-50 border-t-2 border-primary-200">
                          <td className="px-6 py-3 font-black text-primary-800">Net Taxable Income</td>
                          <td className="px-6 py-3 font-black text-right text-primary-700 text-base">{formatCurrency(taxableIncome)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Tax Computation</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs text-slate-400 mb-1">Taxable Income</p>
                        <p className="font-black text-slate-900 text-lg">{formatCurrency(taxableIncome)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-blue-400 mb-1">Tax Payable</p>
                        <p className="font-black text-blue-700 text-lg">{formatCurrency(0)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-4">
                        <p className="text-xs text-emerald-400 mb-1">TDS Deducted</p>
                        <p className="font-black text-emerald-700 text-lg">{formatCurrency(0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DECLARATION */}
              {form16Tab === 'Declaration' && (
                <div className="space-y-6">
                  <div className="bg-purple-600 text-white rounded-2xl p-6">
                    <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Form 16 · Declaration</p>
                    <h3 className="text-lg font-bold mt-1">Employer & Employee Declaration</h3>
                    <p className="text-xs opacity-60 mt-1">Certificate under Section 203 of the Income Tax Act, 1961</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employer Declaration</p>
                    <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed border border-slate-200">
                      I, the undersigned, certify that the total amount of tax deducted at source and deposited to the credit of the Central Government as stated in this certificate is correct and complete.
                      <br /><br />
                      <span className="font-bold">Name:</span> Authorized Signatory, Creative Frenzy<br />
                      <span className="font-bold">Designation:</span> HR / Finance Head<br />
                      <span className="font-bold">Place:</span> Mumbai<br />
                      <span className="font-bold">Date:</span> {new Date().toLocaleDateString('en-IN')}
                    </div>
                    <div className="mt-4 border-t-2 border-dashed border-slate-200 pt-4 text-center">
                      <div className="inline-block border-2 border-slate-300 rounded-xl px-8 py-4 text-slate-400">
                        <p className="text-xs font-semibold">Authorized Signature</p>
                        <p className="text-xs mt-1">& Company Seal</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Acknowledgement</p>
                    <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed border border-slate-200">
                      I, <strong>{f.first_name} {f.last_name}</strong>, acknowledge receipt of Form 16 for the Financial Year {f.financial_year}. The details mentioned in this form are true and correct to the best of my knowledge.
                      <br /><br />
                      <span className="font-bold">Employee Name:</span> {f.first_name} {f.last_name}<br />
                      <span className="font-bold">Employee Code:</span> {f.employee_code}<br />
                      <span className="font-bold">PAN:</span> XXXXX0000X
                    </div>
                    <div className="mt-4 border-t-2 border-dashed border-slate-200 pt-4 text-center">
                      <div className="inline-block border-2 border-slate-300 rounded-xl px-8 py-4 text-slate-400">
                        <p className="text-xs font-semibold">Employee Signature</p>
                        <p className="text-xs mt-1">{f.first_name} {f.last_name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button className="gap-2" onClick={() => {}}>
                      <Download size={16} /> Download Form 16
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Upload Form 16 ══ */}
      <Modal isOpen={showForm16Modal} onClose={() => setShowForm16Modal(false)} title="Upload Form 16">
        <form onSubmit={handleUploadForm16} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">Employee</label>
            <select required value={form16Form.employee_id}
              onChange={e => setForm16Form(p => ({ ...p, employee_id: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-primary-500/20">
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block">Financial Year</label>
            <select value={form16Form.financial_year}
              onChange={e => setForm16Form(p => ({ ...p, financial_year: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-primary-500/20">
              {['2022-23','2023-24','2024-25','2025-26'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
            <Upload size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">Form 16 PDF</p>
            <p className="text-xs text-slate-400 mt-1">(File upload — stored as metadata in demo mode)</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm16Modal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              <Upload size={15} />{submitting ? 'Uploading…' : 'Save Form 16'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Payroll;
