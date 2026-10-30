import React, { useState, useEffect } from 'react';
import { LuSave, LuRefreshCw, LuMail, LuCode, LuSparkles, LuEye, LuCheck } from 'react-icons/lu';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when a new user account is created.',
    variables: ['{{userName}}', '{{role}}', '{{loginUrl}}']
  },
  {
    id: 'forgotPassword',
    name: 'Forgot Password',
    description: 'Sent when a user requests a password reset.',
    variables: ['{{resetLink}}']
  },
  {
    id: 'approval',
    name: 'School Approval',
    description: 'Sent to a School Admin when their registration is approved.',
    variables: ['{{schoolName}}', '{{dashboardLink}}']
  }
];

const DEFAULT_TEMPLATES = {
  welcomeSubject: 'Welcome to queflow Education OS',
  welcomeHtml: `<h2>Hello {{userName}},</h2>
<p>Your account has been successfully created as a <strong>{{role}}</strong>.</p>
<p>Click the link below to access your school portal:</p>
<p><a href="{{loginUrl}}" target="_blank">Access Portal</a></p>`,

  forgotPasswordSubject: 'Password Reset Request',
  forgotPasswordHtml: `<p>We received a request to reset your queflow account password.</p>
<p>Click the link below to securely reset your credentials:</p>
<p><a href="{{resetLink}}" target="_blank">Reset Password</a></p>
<p>This security link will expire in 24 hours.</p>`,

  approvalSubject: 'Your School Account is Approved!',
  approvalHtml: `<h2>Congratulations, {{schoolName}}!</h2>
<p>Your tenant registration for the queflow School Management System has been approved by the Super Admin.</p>
<p>You can now log in and configure your academic year, classes, and roles.</p>
<p><a href="{{dashboardLink}}" target="_blank">Open Admin Dashboard</a></p>`
};

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/schools/global/collections/email_templates/default');
      if (res && res.data) {
        setFormData({ ...DEFAULT_TEMPLATES, ...res.data });
      } else {
        const local = localStorage.getItem('queflow_email_templates');
        if (local) setFormData({ ...DEFAULT_TEMPLATES, ...JSON.parse(local) });
      }
    } catch (error) {
      const local = localStorage.getItem('queflow_email_templates');
      if (local) {
        setFormData({ ...DEFAULT_TEMPLATES, ...JSON.parse(local) });
      } else {
        setFormData(DEFAULT_TEMPLATES);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/schools/global/collections/email_templates/default', formData);
      localStorage.setItem('queflow_email_templates', JSON.stringify(formData));
      toast.success("Email templates saved successfully!");
    } catch (error) {
      localStorage.setItem('queflow_email_templates', JSON.stringify(formData));
      toast.success("Templates saved to local session!");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const activeTemplate = TEMPLATES.find(t => t.id === activeTab);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-white via-white to-orange-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
            <LuMail size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              System Email Templates
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Customize automated transactional emails sent to schools, teachers, and parents.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 transition-all duration-200 disabled:opacity-50 shrink-0"
        >
          {saving ? <LuRefreshCw className="animate-spin" size={16} /> : <LuSave size={16} />}
          Save Templates
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900/80 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row">
        {/* Template Selector Tabs */}
        <div className="w-full lg:w-72 bg-slate-50/80 dark:bg-slate-950/50 border-r border-slate-200/80 dark:border-slate-800 p-4 space-y-2">
          <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Template Categories</p>
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => setActiveTab(template.id)}
              className={`w-full text-left p-3.5 rounded-2xl font-bold transition-all flex items-center gap-3.5 ${activeTab === template.id
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-md shadow-orange-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
            >
              <div className={`p-2 rounded-xl transition-colors ${activeTab === template.id
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                <LuMail size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate">{template.name}</p>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{template.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Template Editor */}
        <div className="flex-1 p-6 md:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {activeTemplate.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{activeTemplate.description}</p>
          </div>

          {/* Subject Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Email Subject Line
            </label>
            <input
              type="text"
              value={formData[`${activeTab}Subject`] || ''}
              onChange={(e) => handleChange(`${activeTab}Subject`, e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
              placeholder="e.g. Welcome to queflow Platform"
            />
          </div>

          {/* HTML Body Editor */}
          <div className="space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <LuCode className="text-orange-500" /> HTML Content Template
              </label>

              {/* Variable Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Variables:</span>
                {activeTemplate.variables.map(v => (
                  <span
                    key={v}
                    className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/40 text-xs font-mono font-bold rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                    title="Click to copy"
                    onClick={() => {
                      navigator.clipboard.writeText(v);
                      toast.success(`Copied ${v}`);
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-inner">
              <ReactQuill
                theme="snow"
                value={formData[`${activeTab}Html`] || ''}
                onChange={(content) => handleChange(`${activeTab}Html`, content)}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'clean']
                  ],
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
