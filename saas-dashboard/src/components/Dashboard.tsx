import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { NavItemId } from '../types';

export interface DashboardProps {
  activeTab: NavItemId;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
}

const CHART_DATA = [
  { time: '00:00', sent: 45000, delivered: 44800, opens: 19200 },
  { time: '03:00', sent: 28000, delivered: 27900, opens: 11400 },
  { time: '06:00', sent: 62000, delivered: 61800, opens: 27100 },
  { time: '09:00', sent: 185000, delivered: 184200, opens: 82900 },
  { time: '12:00', sent: 240000, delivered: 239100, opens: 104500 },
  { time: '15:00', sent: 215000, delivered: 214000, opens: 92400 },
  { time: '18:00', sent: 160000, delivered: 159400, opens: 68100 },
  { time: '21:00', sent: 98000, delivered: 97600, opens: 41200 },
  { time: '24:00', sent: 54000, delivered: 53800, opens: 23000 },
];

const RECENT_EMAILS = [
  {
    id: 'em-9182',
    recipient: 'alex.chen@stripe.dev',
    subject: 'Your monthly billing receipt #INV-4921',
    status: 'Delivered',
    latency: '84ms',
    time: '2m ago',
  },
  {
    id: 'em-9181',
    recipient: 'sarah.k@linear.app',
    subject: 'Password reset authorization code',
    status: 'Delivered',
    latency: '62ms',
    time: '4m ago',
  },
  {
    id: 'em-9180',
    recipient: 'marcus.v@supabase.io',
    subject: 'Welcome to Quaders Cloud — Getting Started',
    status: 'Opened',
    latency: '91ms',
    time: '9m ago',
  },
  {
    id: 'em-9179',
    recipient: 'invalid-mx@olddomain.org',
    subject: 'Action Required: Verify secondary address',
    status: 'Bounced',
    latency: '340ms',
    time: '14m ago',
  },
  {
    id: 'em-9178',
    recipient: 'dev@vercel.com',
    subject: 'Deployment pipeline success: prod-us-east',
    status: 'Delivered',
    latency: '78ms',
    time: '18m ago',
  },
  {
    id: 'em-9177',
    recipient: 'elena.rostova@github.com',
    subject: 'Security Alert: New API key generated',
    status: 'Delivered',
    latency: '65ms',
    time: '22m ago',
  },
];

export const Dashboard: React.FC<DashboardProps> = ({
  activeTab,
  reducedMotion,
  onToggleReducedMotion,
  demoMode,
  onToggleDemoMode,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('All');

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const filteredEmails =
    filterType === 'All'
      ? RECENT_EMAILS
      : RECENT_EMAILS.filter((e) => e.status === filterType);

  return (
    <main className="flex-1 bg-[#0a0a0b] min-h-screen text-[#9ca3af] flex flex-col overflow-y-auto">
      {/* Top Header Bar */}
      <header className="h-[64px] border-b border-white/[0.06] px-8 flex items-center justify-between shrink-0 bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-semibold text-white tracking-tight">
            {activeTab}
          </h1>
          <span className="text-[12px] font-mono text-[#71717a] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md">
            v2.4.0
          </span>
          {demoMode && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
              Demo Loop Active
            </span>
          )}
        </div>

        {/* Header Action controls */}
        <div className="flex items-center gap-3">
          {/* Autoplay Demo Quick Toggle */}
          <button
            type="button"
            onClick={onToggleDemoMode}
            className={`h-[32px] px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all border cursor-pointer ${
              demoMode
                ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                : 'bg-[#131316] border-white/[0.06] text-[#9ca3af] hover:text-white'
            }`}
            title="Toggle Autoplay Demo cursor"
          >
            <Sparkles size={13} className={demoMode ? 'text-yellow-400' : ''} />
            <span>{demoMode ? 'Stop Demo' : 'Autoplay Demo'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={onToggleReducedMotion}
            className={`h-[32px] px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all border cursor-pointer ${
              reducedMotion
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                : 'bg-[#131316] border-white/[0.06] text-[#9ca3af] hover:text-white'
            }`}
            title="Toggle reduced motion"
          >
            <Zap size={13} />
            <span>{reducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}</span>
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            className="h-[32px] px-3.5 rounded-lg text-[12px] font-medium bg-white hover:bg-neutral-200 text-black flex items-center gap-1.5 transition-colors shadow-[0_1px_8px_rgba(255,255,255,0.2)] cursor-pointer"
          >
            <Send size={13} />
            <span>Send Email</span>
          </button>
        </div>
      </header>

      {/* Main Content Area with 200ms quick fade/slide-up */}
      <div className="flex-1 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={
              reducedMotion
                ? { duration: 0.12 }
                : { duration: 0.2, ease: 'easeOut' }
            }
            className="space-y-6"
          >
            {/* Render view according to active tab */}
            {activeTab === 'Emails' && (
              <>
                {/* 4 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Emails Sent */}
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5 hover:border-white/[0.12] transition-colors relative overflow-hidden group">
                    <div className="flex items-center justify-between text-[#71717a] text-[13px] font-medium mb-2">
                      <span>Emails Sent</span>
                      <span className="flex items-center text-emerald-400 text-[12px] font-mono gap-0.5">
                        <ArrowUpRight size={13} /> +12.4%
                      </span>
                    </div>
                    <div className="text-[26px] font-bold text-white tracking-tight">
                      2,842,910
                    </div>
                    <div className="text-[12px] text-[#71717a] mt-1">
                      Past 30 days throughput
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/[0.015] rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                  </div>

                  {/* Card 2: Delivered */}
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5 hover:border-white/[0.12] transition-colors relative overflow-hidden group">
                    <div className="flex items-center justify-between text-[#71717a] text-[13px] font-medium mb-2">
                      <span>Delivered</span>
                      <span className="flex items-center text-emerald-400 text-[12px] font-mono gap-0.5">
                        <ArrowUpRight size={13} /> 99.6%
                      </span>
                    </div>
                    <div className="text-[26px] font-bold text-white tracking-tight">
                      2,831,538
                    </div>
                    <div className="text-[12px] text-[#71717a] mt-1">
                      Avg latency: 74ms
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/[0.02] rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                  </div>

                  {/* Card 3: Open Rate */}
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5 hover:border-white/[0.12] transition-colors relative overflow-hidden group">
                    <div className="flex items-center justify-between text-[#71717a] text-[13px] font-medium mb-2">
                      <span>Open Rate</span>
                      <span className="flex items-center text-emerald-400 text-[12px] font-mono gap-0.5">
                        <ArrowUpRight size={13} /> +3.2%
                      </span>
                    </div>
                    <div className="text-[26px] font-bold text-white tracking-tight">
                      42.8%
                    </div>
                    <div className="text-[12px] text-[#71717a] mt-1">
                      1,211,898 unique opens
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/[0.02] rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                  </div>

                  {/* Card 4: Bounce Rate */}
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5 hover:border-white/[0.12] transition-colors relative overflow-hidden group">
                    <div className="flex items-center justify-between text-[#71717a] text-[13px] font-medium mb-2">
                      <span>Bounce Rate</span>
                      <span className="flex items-center text-emerald-400 text-[12px] font-mono gap-0.5">
                        <ArrowDownRight size={13} /> -0.08%
                      </span>
                    </div>
                    <div className="text-[26px] font-bold text-white tracking-tight">
                      0.41%
                    </div>
                    <div className="text-[12px] text-[#71717a] mt-1">
                      Well below 2.0% threshold
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-500/[0.02] rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                  </div>
                </div>

                {/* Line Chart Card */}
                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">
                        Delivery Throughput & Engagement
                      </h2>
                      <p className="text-[12px] text-[#71717a] mt-0.5">
                        Real-time delivery events and open tracking over the past 24 hours
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
                        <span className="w-2 h-2 rounded-full bg-white"></span> Sent
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] ml-3">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Opens
                      </span>
                    </div>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={CHART_DATA}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.04)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        />
                        <YAxis
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `${val / 1000}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#16161a',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '12px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sent"
                          stroke="#ffffff"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#sentGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="opens"
                          stroke="#818cf8"
                          strokeWidth={1.8}
                          fillOpacity={1}
                          fill="url(#openGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">
                        Recent Activity
                      </h3>
                      <p className="text-[12px] text-[#71717a] mt-0.5">
                        Live stream of outbound transactional messages
                      </p>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1 bg-[#0a0a0b] p-1 rounded-lg border border-white/[0.04]">
                      {['All', 'Delivered', 'Opened', 'Bounced'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFilterType(status)}
                          className={`px-2.5 py-1 text-[12px] rounded-md transition-colors cursor-pointer ${
                            filterType === status
                              ? 'bg-[#1e1e24] text-white font-medium'
                              : 'text-[#71717a] hover:text-white'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-[#71717a] font-medium text-[12px]">
                          <th className="py-3 px-5">ID</th>
                          <th className="py-3 px-5">Recipient</th>
                          <th className="py-3 px-5">Subject</th>
                          <th className="py-3 px-5">Status</th>
                          <th className="py-3 px-5">Latency</th>
                          <th className="py-3 px-5 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredEmails.map((email) => (
                          <tr
                            key={email.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            <td className="py-3.5 px-5 font-mono text-[11px] text-[#71717a]">
                              {email.id}
                            </td>
                            <td className="py-3.5 px-5 font-medium text-white">
                              {email.recipient}
                            </td>
                            <td className="py-3.5 px-5 text-[#9ca3af] max-w-[280px] truncate">
                              {email.subject}
                            </td>
                            <td className="py-3.5 px-5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  email.status === 'Delivered'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : email.status === 'Opened'
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {email.status === 'Delivered' && (
                                  <CheckCircle2 size={11} />
                                )}
                                {email.status === 'Opened' && <Eye size={11} />}
                                {email.status === 'Bounced' && (
                                  <AlertCircle size={11} />
                                )}
                                {email.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 font-mono text-[12px] text-[#71717a]">
                              {email.latency}
                            </td>
                            <td className="py-3.5 px-5 text-right text-[12px] text-[#71717a]">
                              {email.time}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Inboxes View */}
            {activeTab === 'Inboxes' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5">
                    <div className="text-[13px] text-[#71717a]">Active Inboxes</div>
                    <div className="text-[26px] font-bold text-white mt-1">3 / 5</div>
                    <div className="text-[12px] text-emerald-400 mt-1">MX Records Connected</div>
                  </div>
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5">
                    <div className="text-[13px] text-[#71717a]">Inbound Messages</div>
                    <div className="text-[26px] font-bold text-white mt-1">14,290</div>
                    <div className="text-[12px] text-[#71717a] mt-1">Auto-routed via webhooks</div>
                  </div>
                  <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-5">
                    <div className="text-[13px] text-[#71717a]">Spam Filter Score</div>
                    <div className="text-[26px] font-bold text-white mt-1">99.8%</div>
                    <div className="text-[12px] text-emerald-400 mt-1">Zero false positives</div>
                  </div>
                </div>

                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                  <h3 className="text-[15px] font-semibold text-white">Configured Mailboxes</h3>
                  <div className="space-y-3">
                    {[
                      { address: 'support@quaders.dev', role: 'Customer Support Routing', status: 'Healthy' },
                      { address: 'billing@quaders.dev', role: 'Invoices & Stripe Receipts', status: 'Healthy' },
                      { address: 'notifications@quaders.dev', role: 'System Automated Alerts', status: 'Healthy' },
                    ].map((box) => (
                      <div
                        key={box.address}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-white font-medium">{box.address}</div>
                          <div className="text-[12px] text-[#71717a]">{box.role}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> {box.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Broadcasts View */}
            {activeTab === 'Broadcasts' && (
              <div className="space-y-6">
                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">Broadcast Campaigns</h3>
                      <p className="text-[12px] text-[#71717a]">High-volume scheduled product updates and newsletters</p>
                    </div>
                    <button className="h-[32px] px-3 rounded-lg bg-white text-black text-[12px] font-medium flex items-center gap-1.5 cursor-pointer">
                      <Plus size={13} /> New Broadcast
                    </button>
                  </div>

                  <div className="space-y-3">
                    {[
                      { title: 'Spring Product Release 2026', recipients: '84,200', openRate: '48.2%', status: 'Completed' },
                      { title: 'API v2 Deprecation Notice', recipients: '12,940', openRate: '67.4%', status: 'Completed' },
                      { title: 'Weekly Engineering Digest #48', recipients: '45,000', openRate: 'Pending', status: 'Scheduled for Tomorrow' },
                    ].map((campaign) => (
                      <div
                        key={campaign.title}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-white font-medium">{campaign.title}</div>
                          <div className="text-[12px] text-[#71717a]">
                            Recipients: {campaign.recipients} • Open Rate: {campaign.openRate}
                          </div>
                        </div>
                        <span className="text-[12px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-[#9ca3af]">
                          {campaign.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Automations View */}
            {activeTab === 'Automations' && (
              <div className="space-y-6">
                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">Event-Driven Workflows</h3>
                      <p className="text-[12px] text-[#71717a]">Triggers, delays, conditions, and automated email actions</p>
                    </div>
                    <button className="h-[32px] px-3 rounded-lg bg-white text-black text-[12px] font-medium flex items-center gap-1.5 cursor-pointer">
                      <Plus size={13} /> Create Workflow
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        name: 'User Onboarding Sequence',
                        steps: '4 Steps • Delay 2d • Exit on Upgrade',
                        runs: '128,490 triggers',
                        status: 'Running',
                      },
                      {
                        name: 'Trial Expiration Reminder',
                        steps: '3 Steps • Day 11 & Day 14',
                        runs: '49,210 triggers',
                        status: 'Running',
                      },
                      {
                        name: 'Failed Payment Recovery (Dunning)',
                        steps: '5 Steps • Smart Retries • Webhook Ping',
                        runs: '3,840 triggers',
                        status: 'Running',
                      },
                      {
                        name: 'Churn Prevention Survey',
                        steps: '2 Steps • Sent on Cancellation',
                        runs: '890 triggers',
                        status: 'Active',
                      },
                    ].map((workflow) => (
                      <div
                        key={workflow.name}
                        className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{workflow.name}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <div className="text-[12px] text-[#71717a] mb-3">{workflow.steps}</div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#71717a] pt-2 border-t border-white/[0.04]">
                          <span>{workflow.runs}</span>
                          <span className="text-emerald-400">{workflow.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Templates View */}
            {activeTab === 'Templates' && (
              <div className="space-y-6">
                <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6">
                  <h3 className="text-[15px] font-semibold text-white mb-4">Email Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: 'Magic Link Authentication', tags: 'Auth • React Email', updated: '2 hours ago' },
                      { title: 'Invoice Receipt & Tax Breakdown', tags: 'Billing • Tailwind', updated: 'Yesterday' },
                      { title: 'Weekly Product Digest', tags: 'Marketing • HTML', updated: '3 days ago' },
                    ].map((tpl) => (
                      <div
                        key={tpl.title}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-colors"
                      >
                        <div className="h-28 bg-[#0a0a0b] rounded-lg border border-white/[0.04] mb-3 flex items-center justify-center text-[#71717a] text-[12px]">
                          Preview Canvas
                        </div>
                        <div className="text-white font-medium text-[13px]">{tpl.title}</div>
                        <div className="text-[11px] text-[#71717a] mt-1">{tpl.tags}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audience View */}
            {activeTab === 'Audience' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                <h3 className="text-[15px] font-semibold text-white">Contact Lists & Segments</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <div className="text-[#71717a] text-[12px]">Total Subscribers</div>
                    <div className="text-[24px] font-bold text-white mt-1">142,800</div>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <div className="text-[#71717a] text-[12px]">Deliverability Health</div>
                    <div className="text-[24px] font-bold text-emerald-400 mt-1">99.4%</div>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <div className="text-[#71717a] text-[12px]">Active Segments</div>
                    <div className="text-[24px] font-bold text-white mt-1">8</div>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics View */}
            {activeTab === 'Metrics' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                <h3 className="text-[15px] font-semibold text-white">ISP Reputation & Deliverability Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { provider: 'Google Mail (Gmail)', deliverability: '99.8%', dkim: 'Pass', spf: 'Pass' },
                    { provider: 'Microsoft Outlook / Office 365', deliverability: '99.5%', dkim: 'Pass', spf: 'Pass' },
                    { provider: 'Apple iCloud Mail', deliverability: '99.9%', dkim: 'Pass', spf: 'Pass' },
                    { provider: 'Yahoo / AOL Mail', deliverability: '99.1%', dkim: 'Pass', spf: 'Pass' },
                  ].map((isp) => (
                    <div
                      key={isp.provider}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium text-[13px]">{isp.provider}</div>
                        <div className="text-[11px] text-[#71717a]">DKIM: {isp.dkim} • SPF: {isp.spf}</div>
                      </div>
                      <span className="font-mono text-emerald-400 text-[13px] font-semibold">{isp.deliverability}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Domains View */}
            {activeTab === 'Domains' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                <h3 className="text-[15px] font-semibold text-white">Verified Sending Domains</h3>
                <div className="space-y-3">
                  {[
                    { domain: 'quaders.dev', status: 'Verified', records: 'DKIM (2048-bit), SPF, DMARC' },
                    { domain: 'mail.quaders.dev', status: 'Verified', records: 'Custom Return-Path, CNAME' },
                  ].map((dom) => (
                    <div
                      key={dom.domain}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium">{dom.domain}</div>
                        <div className="text-[12px] text-[#71717a]">{dom.records}</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {dom.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs View */}
            {activeTab === 'Logs' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-3 font-mono text-[12px]">
                <div className="text-white font-sans font-semibold text-[15px] mb-2">Live SMTP Event Stream</div>
                {[
                  '[14:27:01] 250 2.0.0 OK: queued as 4VbXl90192z839 -> delivered to mx.google.com',
                  '[14:26:48] 250 2.0.0 Message accepted for delivery -> id=msg_884102941',
                  '[14:26:33] 250 2.1.5 Recipient alex.chen@stripe.dev matched rate-limit bucket (100 req/s)',
                  '[14:25:59] 250 2.0.0 TLS connection established with ECDHE-RSA-AES128-GCM-SHA256',
                ].map((log, idx) => (
                  <div key={idx} className="p-3 bg-black/60 rounded-lg text-[#9ca3af] border border-white/[0.04]">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* API Keys View */}
            {activeTab === 'API keys' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">API Keys</h3>
                    <p className="text-[12px] text-[#71717a]">Authenticate requests using Bearer tokens</p>
                  </div>
                  <button className="h-[32px] px-3 rounded-lg bg-white text-black text-[12px] font-medium flex items-center gap-1.5 cursor-pointer">
                    <Plus size={13} /> Create API Key
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { name: 'Production Sending Key', key: 're_live_928af01928bc9182371', lastUsed: 'Just now' },
                    { name: 'Development & Testing', key: 're_test_4819aa1829cd1029112', lastUsed: '3 days ago' },
                  ].map((apiKey) => (
                    <div
                      key={apiKey.name}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium text-[13px]">{apiKey.name}</div>
                        <div className="text-[11px] font-mono text-[#71717a] mt-0.5">{apiKey.key}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(apiKey.key)}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-white flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Copy size={11} /> {copiedKey === apiKey.key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Webhooks View */}
            {activeTab === 'Webhooks' && (
              <div className="bg-[#131316] border border-white/[0.06] rounded-[16px] p-6 space-y-4">
                <h3 className="text-[15px] font-semibold text-white">Configured Webhook Endpoints</h3>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">https://api.quaders.dev/webhooks/resend</div>
                    <div className="text-[12px] text-[#71717a]">Listening to: email.delivered, email.bounced, email.opened</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Active
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
};
