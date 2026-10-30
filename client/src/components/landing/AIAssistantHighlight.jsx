import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LuSparkles as Sparkles,
  LuBot as Bot,
  LuShieldCheck as ShieldCheck,
  LuZap as Zap,
  LuTable as Table,
  LuArrowRight as ArrowRight,
  LuCheck as Check,
  LuUsers as Users,
  LuTrendingUp as TrendingUp,
  LuCreditCard as CreditCard
} from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

const DEMO_CONVERSATIONS = {
  attendance: {
    query: "How many students are absent today and which classes have lowest attendance?",
    tool: "get_attendance_summary",
    toolLabel: "Scanning Class Attendance Records...",
    response: {
      summary: "Today (August 30, 2026), **18 out of 450 students are absent** (96.0% overall attendance rate).",
      table: [
        { class: "Grade 10-A", total: 42, present: 36, absent: 6, rate: "85.7%" },
        { class: "Grade 8-B", total: 38, present: 33, absent: 5, rate: "86.8%" },
        { class: "Grade 12-Science", total: 45, present: 43, absent: 2, rate: "95.6%" },
        { class: "Grade 6-A", total: 40, present: 40, absent: 0, rate: "100.0%" },
      ],
      note: "💡 Grade 10-A has the lowest attendance rate today."
    }
  },
  fees: {
    query: "Which students have pending fees for Class 10?",
    tool: "get_pending_fees",
    toolLabel: "Querying Fee Structures & Pending Invoices...",
    response: {
      summary: "Found **3 students in Class 10** with overdue or pending tuition fees totaling **₹18,500**.",
      table: [
        { student: "Aarav Sharma", adm: "ADM-1042", fee: "Term 1 Tuition", due: "₹6,500", status: "Overdue" },
        { student: "Priya Patel", adm: "ADM-1089", fee: "Term 1 Tuition", due: "₹6,000", status: "Due in 3 days" },
        { student: "Rohan Verma", adm: "ADM-1120", fee: "Transport Fee", due: "₹6,000", status: "Overdue" },
      ],
      note: "⚡ Automated SMS & WhatsApp reminders are ready to send."
    }
  },
  exams: {
    query: "Show Class 10 Mathematics Term 1 performance summary.",
    tool: "get_class_performance",
    toolLabel: "Analyzing Exam Assessment Ledgers...",
    response: {
      summary: "Class 10 Mathematics overall average is **82.4%** across 42 students.",
      table: [
        { rank: "1st", name: "Ananya Iyer", marks: "98/100", grade: "A+" },
        { rank: "2nd", name: "Vikram Singh", marks: "95/100", grade: "A+" },
        { rank: "3rd", name: "Kabir Mehta", marks: "92/100", grade: "A" },
        { rank: "4th", name: "Sneha Reddy", marks: "89/100", grade: "A" },
      ],
      note: "📈 Overall class score improved by +4.8% compared to Midterm assessments."
    }
  }
};

export default function AIAssistantHighlight() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('attendance');
  const demo = DEMO_CONVERSATIONS[activeTab];

  return (
    <section id="ai-assistant" className="py-20 lg:py-28 relative overflow-hidden bg-slate-900 text-white">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
          >
            <Sparkles size={14} className="animate-pulse" />
            Next-Gen School Intelligence
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight"
          >
            Meet the <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">AI Assistant</span> for Modern Schools
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed"
          >
            Ask questions in plain English and receive real-time, zero-hallucination answers drawn directly from your school's attendance, fees, exams, and student records.
          </motion.p>
        </div>

        {/* Interactive Demo Showcase */}
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Highlights */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 p-1 flex gap-1">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'attendance'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Users size={14} /> Attendance
              </button>
              <button
                onClick={() => setActiveTab('fees')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'fees'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <CreditCard size={14} /> Fee Dues
              </button>
              <button
                onClick={() => setActiveTab('exams')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'exams'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <TrendingUp size={14} /> Exam Analytics
              </button>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5 hover:border-orange-500/40 transition-colors">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Strict Multi-Tenant Security</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Zero direct SQL. Controlled backend tools enforce strict school isolation and role-based permissions.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5 hover:border-orange-500/40 transition-colors">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Instant Natural Language Querying</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    No need to navigate dozens of menus. Simply type or ask questions and get structured answers in seconds.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5 hover:border-orange-500/40 transition-colors">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Table size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Automated Markdown Tables & Reports</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Complex aggregates are formatted into beautiful tables, top-performer rankings, and collection summaries.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full mt-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white text-sm font-bold shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 group transition-all"
            >
              <span>Try queflow AI Assistant</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Right Column: Live Mockup Widget */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-slate-950/90 border border-slate-800 shadow-2xl p-4 sm:p-6 relative overflow-hidden backdrop-blur-xl ring-1 ring-white/10">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">queflow AI Assistant</span>
                    <span className="ml-2 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                      Live ERP
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Real-time</span>
                </div>
              </div>

              {/* User Prompt Bubble */}
              <div className="flex justify-end mb-4">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs sm:text-sm font-medium shadow-md">
                  {demo.query}
                </div>
              </div>

              {/* Tool Execution Tag */}
              <div className="flex items-center gap-2 my-3 pl-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-950/60 border border-orange-800/60 text-orange-300 text-[11px] font-semibold animate-pulse">
                  <Sparkles size={11} className="text-orange-400" />
                  {demo.toolLabel}
                </div>
              </div>

              {/* AI Response Card */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 text-xs sm:text-sm space-y-3">
                <p className="text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: demo.response.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        {Object.keys(demo.response.table[0]).map((key, kIdx) => (
                          <th key={kIdx} className="px-3 py-2 capitalize">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {demo.response.table.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/50">
                          {Object.values(row).map((val, vIdx) => (
                            <td key={vIdx} className="px-3 py-2 font-medium text-slate-300">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-amber-400/90 font-medium">
                  {demo.response.note}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
