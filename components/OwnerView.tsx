import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Message, Client, Booking } from '../types';
import Card from './ui/Card';
import { MailIcon, PaperAirplaneIcon, CalendarIcon, PlusCircleIcon, ClockIcon, UsersIcon, CheckCircleIcon, ChevronLeftIcon } from './icons/Icons';
import MonthlyCalendar from './MonthlyCalendar';
import DayPreview from './DayPreview';
import AvailabilityManager from './AvailabilityManager';

const OwnerView: React.FC = () => {
    const { 
        bookings, 
        bookingRequests, 
        confirmBookingRequest, 
        cancelBooking, 
        updateBooking,
        clients, 
        messages, 
        sendMessage, 
        markThreadAsRead,
        availability,
        services,
        addManualBooking,
        updateClientNotes
    } = useAppContext();

    const [currentTab, setCurrentTab] = useState<'schedule' | 'requests' | 'clients' | 'messages'>('schedule');
    const [scheduleSubTab, setScheduleSubTab] = useState<'view' | 'availability' | 'manual'>('view');
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    // Manual Booking Form State
    const [manualForm, setManualForm] = useState({
        serviceId: services[0]?.id || '',
        customerName: '',
        customerEmail: '',
        time: '09:00 AM',
        date: new Date().toISOString().split('T')[0]
    });

    // Messaging State
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [composeRecipientId, setComposeRecipientId] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const threadScrollRef = useRef<HTMLDivElement>(null);

    // Client Notes State (local for editing)
    const [editingClientNotes, setEditingClientNotes] = useState<Record<string, string>>({});

    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    // Badge Calculations
    const unreadMessagesCount = useMemo(() => 
        messages.filter(m => m.recipientId === 'owner-1' && !m.read).length, 
    [messages]);

    const pendingRequestsCount = bookingRequests.length;

    // Group messages into Email Threads
    const emailThreads = useMemo(() => {
        const groups: Record<string, { client: Client | undefined; messages: Message[]; unreadCount: number }> = {};
        messages.forEach(msg => {
            if (!groups[msg.threadId]) {
                const partnerId = msg.senderId === 'owner-1' ? msg.recipientId : msg.senderId;
                groups[msg.threadId] = {
                    client: clients.find(c => c.id === partnerId),
                    messages: [],
                    unreadCount: 0
                };
            }
            groups[msg.threadId].messages.push(msg);
            if (msg.recipientId === 'owner-1' && !msg.read) groups[msg.threadId].unreadCount++;
        });
        
        return Object.entries(groups)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => {
                const lastA = a.messages[a.messages.length - 1].timestamp;
                const lastB = b.messages[b.messages.length - 1].timestamp;
                return lastB.localeCompare(lastA);
            });
    }, [messages, clients]);

    const activeThread = useMemo(() => {
        return emailThreads.find(t => t.id === selectedThreadId);
    }, [emailThreads, selectedThreadId]);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (threadScrollRef.current) {
            threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
        }
    }, [activeThread]);

    const handleClientSelectForManual = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setManualForm({
                ...manualForm,
                customerName: client.name,
                customerEmail: client.email
            });
        } else {
            setManualForm({
                ...manualForm,
                customerName: '',
                customerEmail: ''
            });
        }
    };

    const handleManualBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const service = services.find(s => s.id === manualForm.serviceId);
        if (!service) return;
        
        await addManualBooking({
            service,
            date: manualForm.date,
            time: manualForm.time,
            customerName: manualForm.customerName,
            customerEmail: manualForm.customerEmail
        });
        
        alert('Booking added!');
        setManualForm({ ...manualForm, customerName: '', customerEmail: '' });
        setScheduleSubTab('view');
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !activeThread || !selectedThreadId) return;
        setIsSending(true);
        const latestMsg = activeThread.messages[activeThread.messages.length - 1];
        const recipientId = latestMsg.senderId === 'owner-1' ? latestMsg.recipientId : latestMsg.senderId;
        await sendMessage(recipientId, latestMsg.subject, replyText, selectedThreadId);
        setReplyText('');
        setIsSending(false);
    };

    const handleComposeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeRecipientId || !composeSubject.trim() || !composeBody.trim()) return;
        setIsSending(true);
        await sendMessage(composeRecipientId, composeSubject, composeBody);
        setIsSending(false);
        setIsComposing(false);
        setComposeRecipientId('');
        setComposeSubject('');
        setComposeBody('');
        setCurrentTab('messages');
    };

    const handleSelectThread = (threadId: string) => {
        setSelectedThreadId(threadId);
        setIsComposing(false);
        markThreadAsRead(threadId);
    };

    const handleApproveRequest = async (requestId: string) => {
        const req = bookingRequests.find(r => r.id === requestId);
        if (!req) return;

        // Confirm the booking in app state
        await confirmBookingRequest(requestId);

        // Generate the confirmation email mailto link
        const subject = encodeURIComponent("Appointment Confirmed - Silky Hair Straightening");
        const body = encodeURIComponent(
            `Hi ${req.customerName},\n\n` +
            `Your appointment for ${req.service.name} has been confirmed!\n\n` +
            `Details:\n` +
            `Date: ${new Date(req.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n` +
            `Time: ${req.time}\n\n` +
            `We look forward to seeing you at the salon.\n\n` +
            `Best regards,\n` +
            `Laura Assuncao\n` +
            `Silky Hair Straightening`
        );

        // Open owner's system email client
        window.location.href = `mailto:${req.customerEmail}?subject=${subject}&body=${body}`;
    };

    const handleCancelWithConfirm = async (bookingId: string) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        if (window.confirm(`Are you sure you want to CANCEL the appointment for ${booking.customerName} on ${booking.date} at ${booking.time}?`)) {
            await cancelBooking(bookingId);
        }
    };

    const handleUpdateBookingNotes = async (booking: Booking) => {
        const newNotes = window.prompt("Owner Notes for this appointment:", booking.ownerNotes || "");
        if (newNotes !== null) {
            await updateBooking(booking.id, { ownerNotes: newNotes });
        }
    };

    const handleSaveClientNote = async (clientId: string) => {
        const notes = editingClientNotes[clientId];
        if (notes !== undefined) {
            await updateClientNotes(clientId, notes);
            alert("Client notes updated successfully.");
        }
    };

    const renderScheduleTabs = () => (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-gray-200">
                {[
                    { id: 'view', label: 'Appointments' },
                    { id: 'availability', label: 'Availability' },
                    { id: 'manual', label: 'Add Booking' }
                ].map(sub => (
                    <button 
                        key={sub.id} 
                        onClick={() => setScheduleSubTab(sub.id as any)} 
                        className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 ${scheduleSubTab === sub.id ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                    >
                        {sub.label}
                    </button>
                ))}
            </div>

            {scheduleSubTab === 'view' && (
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <MonthlyCalendar 
                            currentMonth={currentMonth} 
                            setCurrentMonth={setCurrentMonth} 
                            selectedDate={selectedDate} 
                            setSelectedDate={setSelectedDate} 
                            bookings={bookings} 
                            availability={availability} 
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <DayPreview 
                            date={selectedDate} 
                            bookings={bookings.filter(b => b.date === selectedDateStr)} 
                            availability={availability[selectedDateStr] || []} 
                            onEditBooking={handleUpdateBookingNotes} 
                            onCancelBooking={handleCancelWithConfirm} 
                        />
                    </div>
                </div>
            )}

            {scheduleSubTab === 'availability' && <AvailabilityManager />}

            {scheduleSubTab === 'manual' && (
                <Card className="max-w-2xl mx-auto p-8 border-2">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                        <PlusCircleIcon className="h-6 w-6 text-pink-600" />
                        Add Booking
                    </h3>
                    <form onSubmit={handleManualBookingSubmit} className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Registered Client (Optional)</label>
                            <select 
                                onChange={(e) => handleClientSelectForManual(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none text-sm"
                            >
                                <option value="">-- Select or type below --</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Customer Name</label>
                                <input type="text" required value={manualForm.customerName} onChange={e => setManualForm({...manualForm, customerName: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Customer Email</label>
                                <input type="email" required value={manualForm.customerEmail} onChange={e => setManualForm({...manualForm, customerEmail: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input type="date" required value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                                <input type="text" placeholder="09:00 AM" required value={manualForm.time} onChange={e => setManualForm({...manualForm, time: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service</label>
                                <select value={manualForm.serviceId} onChange={e => setManualForm({...manualForm, serviceId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none">
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors">
                            Confirm Appointment
                        </button>
                    </form>
                </Card>
            )}
        </div>
    );

    const renderMessages = () => (
        <div className="max-w-7xl mx-auto shadow-xl rounded-2xl overflow-hidden flex bg-white border border-gray-200 h-[700px]">
            {/* Sidebar Inbox */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
                <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-900">Inbox</h2>
                    <button 
                        onClick={() => { setIsComposing(true); setSelectedThreadId(null); }}
                        className="p-2 text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
                        title="New Message"
                    >
                        <PlusCircleIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {emailThreads.map((thread) => {
                        const lastMsg = thread.messages[thread.messages.length - 1];
                        const isActive = selectedThreadId === thread.id;
                        return (
                            <button 
                                key={thread.id} 
                                onClick={() => handleSelectThread(thread.id)}
                                className={`w-full text-left p-4 border-b border-gray-100 transition-all ${isActive ? 'bg-white border-l-4 border-l-pink-600 shadow-sm' : 'hover:bg-gray-100'}`}
                            >
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className={`text-sm ${thread.unreadCount > 0 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                        {thread.client?.name || 'Inquiry'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                                        {new Date(lastMsg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <p className={`text-xs truncate ${thread.unreadCount > 0 ? 'font-bold text-black' : 'text-gray-600'}`}>
                                    {lastMsg.subject}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Email Pane */}
            <div className="flex-1 flex flex-col bg-white">
                {isComposing ? (
                    <div className="p-8">
                        <h3 className="text-xl font-black mb-6">Compose New Message</h3>
                        <form onSubmit={handleComposeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Recipient</label>
                                <select 
                                    required 
                                    value={composeRecipientId} 
                                    onChange={e => setComposeRecipientId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                >
                                    <option value="">-- Select Client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={composeSubject} 
                                    onChange={e => setComposeSubject(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                    placeholder="e.g., Regarding your appointment tomorrow"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                                <textarea 
                                    required 
                                    value={composeBody} 
                                    onChange={e => setComposeBody(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl min-h-[200px] focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                                    placeholder="Type your message..."
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={isSending}
                                className="w-full bg-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors"
                            >
                                {isSending ? 'Sending...' : 'Send Message'}
                            </button>
                        </form>
                    </div>
                ) : activeThread ? (
                    <>
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">{activeThread.messages[0].subject}</h2>
                                <div className="text-sm text-gray-500">From: <span className="font-bold text-gray-800">{activeThread.client?.name || 'Unknown'}</span> ({activeThread.client?.email || 'No email'})</div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30" ref={threadScrollRef}>
                            {activeThread.messages.map((msg) => (
                                <div key={msg.id} className={`flex flex-col ${msg.senderId === 'owner-1' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm border ${msg.senderId === 'owner-1' ? 'bg-pink-600 text-white border-pink-700' : 'bg-white text-gray-800 border-gray-200'}`}>
                                        <div className="flex justify-between items-center mb-2 text-[10px] font-bold uppercase opacity-60">
                                            <span>{msg.senderId === 'owner-1' ? 'You' : msg.senderName}</span>
                                            <span className="ml-4">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-gray-200">
                            <form onSubmit={handleSendReply}>
                                <div className="flex gap-4 items-end">
                                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none text-sm min-h-[80px] max-h-[200px] resize-none" />
                                    <button type="submit" disabled={isSending || !replyText.trim()} className="bg-pink-600 text-white p-4 rounded-xl font-bold hover:bg-pink-700 disabled:opacity-50 transition-all flex items-center justify-center h-[56px] w-[56px] shadow-lg">
                                        <PaperAirplaneIcon className="h-6 w-6" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <MailIcon className="h-16 w-16 mb-4 opacity-20" />
                        <p className="font-bold">Select an inquiry or click '+' to compose</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2 bg-gray-200 p-1 rounded-xl shadow-inner">
                {[
                    { id: 'schedule', label: 'Schedule', icon: CalendarIcon, badge: 0 },
                    { id: 'requests', label: 'Requests', icon: ClockIcon, badge: pendingRequestsCount },
                    { id: 'clients', label: 'Clients', icon: UsersIcon, badge: 0 },
                    { id: 'messages', label: 'Inbox', icon: MailIcon, badge: unreadMessagesCount }
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setCurrentTab(tab.id as any)} 
                        className={`py-3 text-xs font-bold capitalize rounded-lg transition-all flex items-center justify-center gap-2 relative ${currentTab === tab.id ? 'bg-white text-pink-600 shadow' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        <div className="relative">
                            <tab.icon className="h-4 w-4" />
                            {tab.badge > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white animate-pulse">
                                    {tab.badge}
                                </span>
                            )}
                        </div>
                        <span className="hidden md:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {currentTab === 'schedule' && renderScheduleTabs()}
            {currentTab === 'messages' && renderMessages()}
            
            {currentTab === 'requests' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-4">
                         <h2 className="text-xl font-black text-gray-900">Pending Requests</h2>
                         <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-black">{bookingRequests.length} Total</span>
                    </div>
                    {bookingRequests.length > 0 ? bookingRequests.map(r => (
                        <Card key={r.id} className="p-6 flex justify-between items-center border-l-4 border-l-yellow-400 shadow-lg">
                            <div>
                                <p className="font-black text-lg text-gray-900">{r.customerName}</p>
                                <p className="text-sm text-gray-500 font-medium">{r.service.name}</p>
                                <p className="text-xs text-pink-600 font-bold uppercase tracking-wider mt-1">{new Date(r.date).toLocaleDateString()} at {r.time}</p>
                                {r.customerNotes && (
                                    <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">"{r.customerNotes}"</p>
                                )}
                            </div>
                            <button 
                                onClick={() => handleApproveRequest(r.id)} 
                                className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-xl text-sm font-black shadow-md transition-all active:scale-95"
                            >
                                Approve & Email
                            </button>
                        </Card>
                    )) : (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-inner">
                            <ClockIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold">No pending requests</p>
                        </div>
                    )}
                </div>
            )}

            {currentTab === 'clients' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(c => (
                        <Card key={c.id} className="p-6 flex flex-col gap-4 border-2 hover:border-pink-300 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-pink-50 rounded-full flex items-center justify-center text-pink-600 font-bold text-xl">{c.name.charAt(0)}</div>
                                <div>
                                    <p className="font-bold text-gray-900">{c.name}</p>
                                    <p className="text-xs text-gray-500">{c.email}</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Private Owner Notes</label>
                                <textarea 
                                    value={editingClientNotes[c.id] ?? c.ownerNotes ?? ''}
                                    onChange={(e) => setEditingClientNotes({ ...editingClientNotes, [c.id]: e.target.value })}
                                    placeholder="Add private details about this client..."
                                    className="w-full text-xs p-3 bg-yellow-50 border border-yellow-200 rounded-xl focus:ring-1 focus:ring-yellow-400 outline-none resize-none min-h-[80px]"
                                />
                                <button 
                                    onClick={() => handleSaveClientNote(c.id)}
                                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-yellow-700 hover:text-yellow-800 bg-yellow-100 px-3 py-1 rounded-full transition-colors self-end"
                                >
                                    <CheckCircleIcon className="h-3 w-3" /> Save Client Notes
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OwnerView;
