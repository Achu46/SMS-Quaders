import React from 'react';
import { LuZap as Zap, LuSparkles as Sparkles, LuClock as Clock } from 'react-icons/lu';

export default function AIUsageMeter({ usage, compact = false, onUpgradeClick }) {
  if (!usage) return null;

  const isUnlimited = usage.isUnlimited || usage.plan === 'SUPER_ADMIN' || usage.limit === 'Unlimited';
  const plan = usage.plan || 'FREE';
  const limit = usage.limit || 1;
  const usedToday = usage.usedToday || 0;
  const remaining = isUnlimited ? 'Unlimited' : (usage.remaining !== undefined ? usage.remaining : Math.max(0, limit - usedToday));
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((usedToday / (limit || 1)) * 100));

  const isExhausted = !isUnlimited && remaining === 0;

  if (compact) {
    if (isUnlimited) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-xs">
          <Sparkles size={12} className="text-purple-500 fill-purple-400" />
          <span>Unlimited (Super Admin)</span>
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
        isExhausted 
          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60'
      }`}>
        <Zap size={12} className={isExhausted ? 'text-rose-500' : 'text-orange-500 fill-orange-500'} />
        <span>{remaining} / {limit} left today</span>
      </div>
    );
  }

  if (isUnlimited) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/10 via-slate-900 to-slate-900 border border-purple-500/30 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">AI Assistant Quota</h4>
              <p className="text-xs text-purple-300">Super Administrator</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Unlimited
          </span>
        </div>
        <p className="text-xs text-slate-400">
          You have unrestricted platform-wide AI chat access across all schools.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">AI Assistant Quota</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{plan} Plan</p>
          </div>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          isExhausted 
            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
        }`}>
          {remaining} remaining
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full transition-all duration-500 rounded-full ${
            percentage >= 100 
              ? 'bg-rose-500' 
              : percentage >= 75 
                ? 'bg-amber-500' 
                : 'bg-gradient-to-r from-orange-500 to-amber-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{usedToday} / {limit} requests used today</span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> Resets midnight UTC
        </span>
      </div>

      {isExhausted && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold hover:shadow-md transition-all text-center flex items-center justify-center gap-1.5"
        >
          <Zap size={13} /> Upgrade Plan for More Daily Requests
        </button>
      )}
    </div>
  );
}
