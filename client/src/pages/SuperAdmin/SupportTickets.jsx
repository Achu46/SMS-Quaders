import React, { useState, useEffect } from 'react';
import { 
  LuLifeBuoy, LuSearch, LuMessageSquare, LuCircleCheck, LuClock, LuX, 
  LuSend, LuTrash2, LuUser, LuPlus, LuFilter, LuCircleAlert, LuArrowUpRight, LuBuilding2
} from 'react-icons/lu';
import { api } from '../../services/api';
import { socket } from '../../firebase/config';
import ConfirmModal from '../../components/ConfirmModal';

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, ticketId: null });
  const itemsPerPage = 8;

  // Fetch tickets from API
  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await api.get('/tickets');
      setTickets(data || []);
    } catch (e) {
      console.warn('Error loading support tickets:', e);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();

    const handleUpdate = (payload) => {
      if (payload.collection === 'support_tickets' || payload.type === 'ticket') {
        loadTickets();
      }
    };

    socket.on('collection_change', handleUpdate);
    return () => {
      socket.off('collection_change', handleUpdate);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleStatusChange = async (ticketId, newStatus) => {
    const formattedStatus = newStatus.toUpperCase().replace('-', '_');
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: formattedStatus } : t));
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => ({ ...prev, status: formattedStatus }));
    }

    try {
      await api.put(`/tickets/${ticketId}/status`, {
        status: formattedStatus
      });
    } catch (err) {
      console.warn('Status update warning:', err);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSubmittingReply(true);

    try {
      const replyObj = await api.post(`/tickets/${selectedTicket.id}/reply`, {
        message: replyText.trim()
      });

      const updatedMessages = [...(selectedTicket.messages || []), replyObj];

      setSelectedTicket(prev => ({ ...prev, messages: updatedMessages, status: 'IN_PROGRESS' }));
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: updatedMessages, status: 'IN_PROGRESS' } : t));
      setReplyText('');
    } catch (err) {
      console.warn('Reply update error:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCreateSampleTicket = async () => {
    try {
      const created = await api.post('/tickets', {
        subject: 'Inquiry on Bulk Student Admission Import',
        priority: 'HIGH',
        description: 'We need assistance importing 450 student records from CSV. Could you please confirm if custom demographic fields are supported?'
      });
      setTickets(prev => [created, ...prev]);
    } catch (err) {
      console.error('Failed to create sample ticket:', err);
    }
  };

  const handleDeleteTicket = async () => {
    const { ticketId } = confirmModal;
    if (!ticketId) return;

    setConfirmModal({ isOpen: false, ticketId: null });
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    if (selectedTicket?.id === ticketId) setSelectedTicket(null);

    try {
      await api.delete(`/tickets/${ticketId}`);
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const schoolName = t.school || t.clientName || 'School Admin';
    const matchesSearch = 
      schoolName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress' || t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <LuCircleCheck size={13} /> Resolved
          </span>
        );
      case 'in-progress':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <LuClock size={13} /> In Progress
          </span>
        );
      case 'open':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <LuCircleAlert size={13} /> Open
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">High Priority</span>;
      case 'medium':
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Medium</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Normal</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-white via-white to-orange-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
            <LuLifeBuoy size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Support Desk & Tickets
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage live support requests and technical issues across all tenant schools.
            </p>
          </div>
        </div>

        <button 
          onClick={handleCreateSampleTicket}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 transition-all duration-200 shrink-0"
        >
          <LuPlus size={18} />
          Create Test Ticket
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Tickets</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Open Attention</p>
          <p className="text-2xl sm:text-3xl font-black text-orange-600 dark:text-orange-400 mt-1.5">{stats.open}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">In Progress</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1.5">{stats.inProgress}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Resolved</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{stats.resolved}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <LuSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket ID, school, subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/80 w-full sm:w-auto overflow-x-auto">
          {['all', 'open', 'in-progress', 'resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                statusFilter === st 
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      {paginatedTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-500 mb-5 shadow-inner">
            <LuLifeBuoy size={36} className="animate-spin-slow" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">No tickets match your query</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mt-2 mb-6 leading-relaxed">
            All tenant schools are running smoothly without active support issues. You can create a test ticket to preview the resolution flow.
          </p>
          <button
            onClick={handleCreateSampleTicket}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-colors"
          >
            <LuPlus size={16} />
            Generate Sample Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedTickets.map((ticket) => (
            <div 
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="group bg-white dark:bg-slate-900/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-orange-500/40 shadow-sm transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20 mt-0.5">
                  <LuMessageSquare size={18} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">{ticket.id}</span>
                    {getPriorityBadge(ticket.priority)}
                    {getStatusBadge(ticket.status)}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {ticket.subject}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <LuBuilding2 size={13} className="text-orange-500" />
                      {ticket.school || 'School Admin'}
                    </span>
                    <span>•</span>
                    <span>{new Date(ticket.createdAt || Date.now()).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{ticket.messages?.length || 1} messages</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmModal({ isOpen: true, ticketId: ticket.id });
                  }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                  title="Delete ticket"
                >
                  <LuTrash2 size={16} />
                </button>
                <div className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform">
                  View & Reply <LuArrowUpRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Details & Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400">{selectedTicket.id}</span>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{selectedTicket.subject}</h2>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            {/* Conversation Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/40">
              {/* Original Description */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1.5">
                  {selectedTicket.school || 'Tenant Admin'}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* Thread Messages */}
              {(selectedTicket.messages || []).map((msg, idx) => {
                const isAgent = msg.senderRole === 'SUPER_ADMIN' || msg.sender === 'Agent' || msg.senderRole === 'ADMIN';
                const messageText = msg.message || msg.text || '';
                const authorName = msg.senderName || msg.author || (isAgent ? 'Support Agent' : 'User');
                const timeString = new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div 
                    key={idx}
                    className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                      isAgent 
                        ? 'bg-orange-600 text-white rounded-br-none shadow-md shadow-orange-500/20' 
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-bl-none shadow-sm'
                    }`}>
                      <p className="text-[11px] font-bold opacity-75 mb-1">{authorName}</p>
                      <p className="leading-relaxed whitespace-pre-wrap">{messageText}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {timeString}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Reply Input Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">Quick Status:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'in-progress')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                  >
                    Mark In-Progress
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'resolved')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a support response to the school admin..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md shadow-orange-500/20"
                >
                  <LuSend size={16} /> Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, ticketId: null })}
        onConfirm={handleDeleteTicket}
        title="Delete Support Ticket"
        message="Are you sure you want to remove this support ticket from the system?"
      />
    </div>
  );
}
