import React, { useState, useEffect, useRef } from 'react';
import { 
  LuSparkles as Sparkles, 
  LuSend as Send, 
  LuBot as Bot, 
  LuUser as User, 
  LuLoader as Loader2, 
  LuMaximize2 as Maximize2, 
  LuMinimize2 as Minimize2, 
  LuTrash2 as Trash2, 
  LuX as X, 
  LuCopy as Copy, 
  LuCheck as Check, 
  LuInfo as Info,
  LuPanelLeft as PanelLeft,
  LuPlus as Plus,
  LuMessageSquare as MessageSquare,
  LuCalendar as Calendar
} from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { aiService } from '../../services/aiService';
import MarkdownRenderer from './MarkdownRenderer';
import AIUsageMeter from './AIUsageMeter';

const SUGGESTED_PROMPTS = [
  "How many students are absent today?",
  "Show students with attendance below 75%",
  "Which students have pending fees?",
  "Show Class 10 exam performance summary",
  "How many schools are registered in the system?"
];

export default function AIAssistantWidget() {
  const { userProfile } = useAuth();

  const role = (userProfile?.role || '').toUpperCase();
  const isAuthorized = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Conversations history state
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  const initialWelcomeMessage = {
    role: 'assistant',
    content: `Hello ${userProfile?.name || 'there'}! I'm your **School Management AI Assistant**. You can ask me real-time questions about attendance, student profiles, pending fees, exam marks, or registered schools.`,
    timestamp: new Date().toISOString()
  };

  const [messages, setMessages] = useState([initialWelcomeMessage]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState(null);
  const [usage, setUsage] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      fetchUsage();
      fetchConversations();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Global Keyboard Shortcut (Ctrl+J / Cmd+J) and Custom Event Listener
  useEffect(() => {
    if (!isAuthorized) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-ai-assistant', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-ai-assistant', handleCustomOpen);
    };
  }, [isAuthorized]);

  const fetchUsage = async () => {
    const data = await aiService.getUsage();
    if (data) {
      setUsage(data);
    }
  };

  const fetchConversations = async () => {
    const list = await aiService.getConversations();
    if (list && Array.isArray(list)) {
      setConversations(list);
    }
  };

  // Start a brand new conversation
  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([initialWelcomeMessage]);
    setInputValue('');
    setCurrentTool(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Load a past conversation
  const handleSelectConversation = async (conv) => {
    try {
      setLoading(true);
      const fullConv = await aiService.getConversation(conv.id);
      if (fullConv && fullConv.messages && Array.isArray(fullConv.messages)) {
        setCurrentConversationId(fullConv.id);
        setMessages(fullConv.messages);
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await aiService.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (currentConversationId === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const prompt = (textToSend || inputValue).trim();
    if (!prompt || loading) return;

    // Check if daily quota is already exhausted (non-superadmin)
    if (usage && !usage.isUnlimited && usage.remaining === 0) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt, timestamp: new Date().toISOString() },
        { 
          role: 'assistant', 
          content: `⚠️ **Daily AI Request Limit Reached**\nYour school has used all **${usage.limit} daily AI requests** for today on the **${usage.plan} Plan**.\n\nYour limit resets at **midnight UTC** (${usage.resetTime ? new Date(usage.resetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00 UTC'}). Please upgrade your plan for higher daily limits.`, 
          timestamp: new Date().toISOString() 
        }
      ]);
      setInputValue('');
      return;
    }

    const userMessage = { role: 'user', content: prompt, timestamp: new Date().toISOString() };
    const updatedHistory = [...messages, userMessage];

    setMessages(updatedHistory);
    setInputValue('');
    setLoading(true);
    setCurrentTool('Consulting ERP database...');

    try {
      // Format messages payload for server
      const apiPayload = updatedHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await aiService.sendMessage(apiPayload);

      if (response && response.usage) {
        setUsage(response.usage);
      }

      const assistantMessage = {
        role: 'assistant',
        content: response.reply,
        toolsUsed: response.toolsUsed,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...updatedHistory, assistantMessage];
      setMessages(finalMessages);

      // Auto-save conversation to database
      try {
        const saved = await aiService.saveConversation({
          id: currentConversationId,
          messages: finalMessages
        });
        if (saved && saved.id) {
          setCurrentConversationId(saved.id);
          fetchConversations();
        }
      } catch (saveErr) {
        console.error('Error auto-saving conversation:', saveErr);
      }

    } catch (error) {
      console.error('AI Assistant chat error:', error);
      const errMsg = error.message || 'Failed to get a response from AI Assistant.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ **Error**: ${errMsg}`,
          isError: true,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      setCurrentTool(null);
      fetchUsage();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Format friendly tool name for UI
  const formatToolName = (toolName) => {
    switch (toolName) {
      case 'get_schools_overview':
        return 'Scanning All Registered Schools Across Platform';
      case 'get_school_info':
        return 'Fetching School Profile & Details';
      case 'get_attendance_summary':
      case 'get_class_attendance':
      case 'get_student_attendance':
        return 'Checking Attendance Records';
      case 'get_pending_fees':
      case 'get_student_fee_status':
      case 'get_payment_history':
        return 'Accessing Fee & Invoice Ledgers';
      case 'get_class_performance':
      case 'get_student_exam_results':
      case 'get_class_exam_results':
        return 'Calculating Academic & Exam Marks';
      case 'search_student':
      case 'get_student_profile':
      case 'get_student':
        return 'Searching Student Directory';
      case 'get_teacher':
      case 'get_teacher_schedule':
      case 'get_class_timetable':
        return 'Retrieving Timetable Schedules';
      default:
        return 'Querying ERP Services';
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (Icon Only) */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 group w-12 h-12 rounded-full bg-gradient-to-tr from-orange-600 via-amber-600 to-orange-500 text-white shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        title="Open AI Assistant (Ctrl + J)"
        aria-label="Open AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles size={22} className="animate-pulse group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping" />
        </div>
      </button>

      {/* Centered Chat Popup Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/40 dark:bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          {/* Backdrop Click Dismiss */}
          <div 
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
          />

          {/* Main Centered Popup Card */}
          <div className={`relative w-full transition-all duration-300 ease-out flex flex-col bg-white/98 dark:bg-slate-900/98 backdrop-blur-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl shadow-slate-950/30 dark:shadow-black/70 overflow-hidden ring-1 ring-black/5 animate-scale-in ${
            isExpanded
              ? 'max-w-4xl h-[780px] max-h-[94vh]'
              : 'max-w-3xl h-[680px] max-h-[90vh]'
          }`}>

            {/* Popup Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-slate-50/90 via-orange-50/30 to-amber-50/20 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-slate-950/80 select-none">
              <div className="flex items-center gap-2.5">
                {/* Toggle History Sidebar */}
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-1.5 rounded-xl border transition-all ${
                    showHistory 
                      ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={showHistory ? 'Hide history' : 'Chat history'}
                >
                  <PanelLeft size={17} />
                </button>

                {/* New Chat Quick Button */}
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold transition-all border border-orange-200/60 dark:border-orange-800/60"
                  title="Start a new conversation"
                >
                  <Plus size={14} />
                  <span className="hidden sm:inline">New Chat</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 ml-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                    AI ERP Assistant
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Live
                  </span>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1.5">
                {usage && (
                  <AIUsageMeter usage={usage} compact={true} />
                )}

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden sm:flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title={isExpanded ? 'Restore size' : 'Expand window'}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Close (Esc)"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Content Body: Chat + Collapsible History Sidebar */}
            <div className="flex-1 flex overflow-hidden relative">

              {/* Chat History Sidebar Drawer */}
              {showHistory && (
                <div className="w-64 sm:w-72 border-r border-slate-200/80 dark:border-slate-800/80 bg-slate-50/95 dark:bg-slate-950/95 flex flex-col shrink-0 overflow-hidden animate-fade-in">
                  <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-orange-500" />
                      Chat History
                    </span>
                    <button
                      onClick={handleNewChat}
                      className="p-1 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-950/50 rounded-lg transition-colors"
                      title="New chat"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No previous chats yet.
                      </div>
                    ) : (
                      conversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={`group w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            currentConversationId === conv.id
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/30'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MessageSquare size={13} className="shrink-0 text-slate-400 group-hover:text-orange-500" />
                            <span className="truncate">{conv.title || 'Conversation'}</span>
                          </div>

                          <button
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                            title="Delete chat"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Main Message Stream */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 items-start animate-fade-in ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                            <Bot size={16} />
                          </div>
                        )}

                        <div className={`group relative max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm ${
                          isUser 
                            ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white shadow-md shadow-orange-500/15'
                            : msg.isError
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 shadow-xs'
                        }`}>
                          {/* Tool Badges */}
                          {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                              {msg.toolsUsed.map((tool, tIdx) => (
                                <span 
                                  key={tIdx} 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                                >
                                  <Sparkles size={10} className="text-orange-500" />
                                  <span>{formatToolName(tool)}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Message Content */}
                          {isUser ? (
                            <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}

                          {/* Action Footer */}
                          {!isUser && !msg.isError && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              <button
                                onClick={() => copyToClipboard(msg.content, idx)}
                                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Copy answer"
                              >
                                {copiedIndex === idx ? (
                                  <>
                                    <Check size={11} className="text-emerald-500" />
                                    <span className="text-emerald-500">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                            <User size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Real-time Tool Activity Indicator */}
                  {loading && (
                    <div className="flex gap-3 items-start animate-fade-in">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Bot size={16} />
                      </div>
                      <div className="rounded-2xl p-4 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                          <Loader2 size={14} className="animate-spin text-orange-500" />
                          <span>{currentTool || 'Querying database...'}</span>
                        </div>
                        <div className="h-1.5 w-36 bg-orange-200/60 dark:bg-orange-950/60 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full animate-pulse w-2/3" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty State / Suggested Prompts */}
                  {messages.length === 1 && !loading && (
                    <div className="pt-2 animate-fade-in">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                        Suggested Queries
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SUGGESTED_PROMPTS.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(prompt)}
                            className="text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-slate-200/60 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-800/60 text-xs text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.01]"
                          >
                            <span className="line-clamp-2">💬 {prompt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Controls Bar */}
                <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60">
                  <div className="relative flex items-center">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        usage && !usage.isUnlimited && usage.remaining === 0
                          ? 'Daily limit reached. Resets at midnight UTC...'
                          : 'Ask anything about students, attendance, fees, exams...'
                      }
                      disabled={loading || (usage && !usage.isUnlimited && usage.remaining === 0)}
                      rows={1}
                      className="w-full resize-none rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 pl-4 pr-12 py-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />

                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim() || loading || (usage && !usage.isUnlimited && usage.remaining === 0)}
                      className="absolute right-2 p-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:scale-105 active:scale-95 transition-all"
                      title="Send question (Enter)"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Info size={11} /> AI outputs real-time live database records
                    </span>
                    <span className="hidden sm:inline">Press <strong>Enter ↵</strong> to send</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
