import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ScrollText, Pencil, Save, X } from 'lucide-react';
import { Card } from '../components/ui/Card';

// Initial company policy. Once a SUPER_ADMIN saves an edit, the stored version
// (company_settings.rulesPolicies) takes over. Markdown: ##/### headings, - bullets,
// **bold**, --- divider.
const DEFAULT_POLICIES = `# Rules & Policies

We all are committed to fair and honest conduct and the use of best judgment and common sense skills in the organizational practices of Creative Frenzy Pvt. Ltd.. Reputation of an organization depends on you taking personal responsibility for maintaining and adhering to the policies and guidelines set forth here. Your continued cooperation in this regard will be highly appreciated.

## Applicability

All the decided rules shall be applied to all the employees of the company and its subsidiaries. Management is authorized to decide on any addition or exemption from these rules. Management of the company will be the sole judge of the interpretation of these rules and their decision shall be binding on all.

## On The Job

### Punctuality
We feel that each one of our employees is responsible enough to understand the importance of punctuality and regularity in their job and would live up to the faith and confidence that we repose in them.

It will be the responsibility of each Team Lead to ensure his / her team maintains punctuality on their job, while reporting to the office or while executing an assignment as per the deadline.

If you add together the hourly wages of every employee late minutes, it is amazingly costs us when we start late, so be on time.

### Personal Belongings
Personal belongings/valuables are the individual's responsibility. Due to security reasons, we advise you to keep the bags, helmet and others stuff outside the floor/working area or seek the permission of HR for its safe storage.

Use of personal laptop, tablets, connecting accessories, storage devices, CD, floppy, pen drives, digital cameras and other data storage and surveillance devices is strictly prohibited. If you carry something by mistake or see any such things with any employee in the office report to HR immediately. In random check, if any such thing is found in the possession of an employee, strict action will be taken for data security violation.

### Upkeep / Hygiene
It is the duty of each and every employee to ensure a clean working environment and that the workstation is kept neat and tidy at all times.

### Outside Visitors
All visitors must be met outside the premises. No visitor is allowed to enter the office area.

### Public Holidays
Public Holidays are decided at the beginning of the year.

---

## Payroll Policy

- Employees joining on or before the 15th will receive salary in the same month; those joining after the 15th will receive salary in the next month's payroll cycle.
- Employees must serve a 45-day notice period before leaving the company.
- No leave is allowed during the notice period. Any emergency leave taken will extend the notice period by the same number of days.
- After resignation, your previous leave balance (if any) will be nullified and you will not be entitled to avail any leaves during your notice period.
- Employees leaving without serving the notice period will not be eligible for company documents or benefits.
- All company assets, documents, and client-related information must be submitted before exit.

---

## Leaves

- Employees are entitled to 6 Casual Leaves (CL) and 6 Sick Leaves (SL) per calendar year (January to December). Unused leaves will lapse at the end of the year and cannot be carried forward or encashed.
- A maximum of 4 consecutive leave days may be availed at one time. Any leave exceeding 4 consecutive days requires management approval with a valid reason, such as a wedding, medical emergency, or other unavoidable personal circumstances.
- All leave requests require prior HR approval. Any leave taken without approval will be treated as unauthorized absence, even if Casual Leave (CL) or Sick Leave (SL) is available.
- For each unauthorized absence, the company will deduct two days' salary or more, depending on the seriousness of the case. Zero tolerance will be applied to unauthorized absenteeism.
- **Maternity Leave:** As per the Indian Maternity Benefit Act, 1961, eligible employees are entitled to up to 13 weeks or 26 weeks of fully paid maternity leave for their first two children.
- **Paternity Leave:** New fathers are entitled to 1 week of paid leave to support their spouse and care for their newborn child.
- **Marriage Leave:** Employees are entitled to 5 working days of paid leave on the occasion of their marriage. Any extension beyond 5 days will be treated as unpaid leave, subject to approval.

---

## Absent

- **Sandwich Leave:** If leave is taken on both sides of a weekly off or public holiday, the intervening holiday/off days will also be counted as leave. Casual Leave (CL) or Balance Leave cannot be availed under the Sandwich Leave policy.
- If an employee remains on leave for five consecutive working days (Monday to Friday), the adjoining Saturday and Sunday will also be counted as leave under the Sandwich Leave policy.
- If a public holiday falls on a Tuesday, the preceding Monday will be a mandatory working day. If a public holiday falls on a Thursday, the following Friday will be a mandatory working day.
- Any absence on these mandatory working days will be treated under the Sandwich Leave Policy, and the holiday along with adjoining days (including Saturday and Sunday) will be counted as leave.
- Repeatedly taking leave around weekends or holidays will be treated as misuse of the leave policy and may lead to disciplinary action. Such instances may also impact the employee's performance evaluation and salary increment.

---

## Attendance Code & Rules

- Office timings are 10:00 AM to 7:00 PM, Monday to Friday.
- A slab of 15 minutes is taken as consideration for any anonymous event.
- Employees reporting to the office up to 10:15 AM will be considered **On Time**.
- Employees reporting after 10:15 AM will be marked as **Late**.
- Employees reporting at 11:00 AM will be marked as **Over-Late**.
- Employees reporting to the office after 11:30 AM will be marked as **Half-Day**.
- Half day's salary shall be deducted on every third instance of "LATE" OR every second instance of "OVER-LATE" reporting during the month.
- A maximum 40-minute lunch break is allowed between 1:00 PM and 3:00 PM.
- Every employee on reporting for duty shall immediately login with the assigned company ID in Desktrack system.
- You are allowed to go 'out of office/call/breaks' for maximum 2 times a day for up to (10-15 Minutes Maximum) each, by selecting the appropriate option, if really needed. Breaks can be taken any time after your first 1 hours and before 1 hour of working day end on a given workday. Employees should use the break room rather than stay in the work area.
- Employees are not allowed to leave the floor at the same time. Breaks or time off the floor must be planned in such a way that adequate attendance is maintained at all times, except during the lunch break.
- We understand there are times when an employee has an emergency, such as when they feel ill or have to take an urgent phone call. Talk to your supervisor in these situations to accommodate your emergency.
- Employees must follow the 'Desktrack' system thoroughly; violation will lead to strict action. About guidance how to use Desktrack system ask your HR.
- After login stick to your desk only and work sincerely on assigned task rather than doing anything else. Maintain silence on the floor.
- You must maintain discipline and execute the work professionally with utmost productivity. Misconduct and indecency with any of seniors/colleagues/juniors will not be tolerated.`;

// Minimal inline renderer: **bold** within a line.
const renderInline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );

// Minimal block renderer (no markdown dependency): #/##/### headings, - / • bullets,
// --- divider, blank-line paragraphs.
const renderMarkdown = (md) => {
  const lines = (md || '').split('\n');
  const blocks = [];
  let list = null;
  const flushList = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null; } };
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { flushList(); blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') }); }
    else if (/^##\s+/.test(line)) { flushList(); blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') }); }
    else if (/^#\s+/.test(line)) { flushList(); blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') }); }
    else if (/^---+\s*$/.test(line)) { flushList(); blocks.push({ type: 'hr' }); }
    else if (/^\s*[-•]\s+/.test(line)) { (list = list || []).push(line.replace(/^\s*[-•]\s+/, '')); }
    else if (line.trim() === '') { flushList(); }
    else { flushList(); blocks.push({ type: 'p', text: line }); }
  });
  flushList();
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'h1': return <h1 key={i} className="text-2xl font-bold text-slate-900 font-display mt-2 mb-3">{renderInline(b.text)}</h1>;
      case 'h2': return <h2 key={i} className="text-lg font-bold text-primary-700 font-display mt-7 mb-2">{renderInline(b.text)}</h2>;
      case 'h3': return <h3 key={i} className="text-sm font-bold text-slate-800 uppercase tracking-wide mt-4 mb-1">{renderInline(b.text)}</h3>;
      case 'hr': return <hr key={i} className="my-6 border-slate-200" />;
      case 'ul': return <ul key={i} className="list-disc pl-5 space-y-1.5 my-2 text-sm text-slate-600 leading-relaxed">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
      default: return <p key={i} className="text-sm text-slate-600 leading-relaxed my-2">{renderInline(b.text)}</p>;
    }
  });
};

const RulesPolicies = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [content, setContent] = useState(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/config')
      .then(res => { if (res.data?.rulesPolicies) setContent(res.data.rulesPolicies); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = () => { setDraft(content); setEditing(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/config', { settings: { rulesPolicies: draft } });
      setContent(draft);
      setEditing(false);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-100 text-primary-700"><ScrollText size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Rules & Policies</h1>
            <p className="text-sm text-slate-500">Company guidelines for all employees of Creative Frenzy Pvt. Ltd.</p>
          </div>
        </div>
        {isSuperAdmin && !editing && (
          <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors shrink-0">
            <Pencil size={16} /> Edit
          </button>
        )}
      </div>

      <Card className="p-8">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
        ) : editing ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Markdown supported — <code className="text-primary-600">##</code> heading,
              <code className="text-primary-600"> ###</code> sub-heading,
              <code className="text-primary-600"> -</code> bullet,
              <code className="text-primary-600"> **bold**</code>,
              <code className="text-primary-600"> ---</code> divider.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full h-[60vh] p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 font-mono leading-relaxed focus:outline-none focus:border-primary-500 resize-y"
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors disabled:opacity-50">
                <X size={16} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <article>{renderMarkdown(content)}</article>
        )}
      </Card>
    </div>
  );
};

export default RulesPolicies;
