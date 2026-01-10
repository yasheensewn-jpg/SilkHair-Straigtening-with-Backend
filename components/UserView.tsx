import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Message, Service, Booking } from '../types';
import Card from './ui/Card';
import { MailIcon, PaperAirplaneIcon, PlusCircleIcon, UserCircleIcon, CalendarIcon, ClockIcon, CutIcon, ChevronLeftIcon, CheckCircleIcon, TrashIcon } from './icons/Icons';
import { useTranslation } from 'react-i18next';
import MonthlyCalendar from './MonthlyCalendar';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateEndTime } from '../utils/timeUtils';

const UserView: React.FC = () => {
    const {
        services, addBookingRequest, currentUser, messages, sendMessage,
        markThreadAsRead, availability, bookings, bookingRequests,
        getCalculatedAvailableSlots, deleteMessage, deleteThread
    } = useAppContext();

    const { t, i18n } = useTranslation();

    const [viewMode, setViewMode] = useState<'book' | 'my-appointments' | 'messages' | 'profile'>('book');
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [bookingNotes, setBookingNotes] = useState('');

    // Messaging State
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newBody, setNewBody] = useState('');
    const userThreadScrollRef = useRef<HTMLDivElement>(null);

    // Profile Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const { updateUserProfile } = useAppContext();

    const availableSlots = useMemo(() => {
        if (!selectedDate || !selectedService) return [];
        const dateStr = getLocalDateString(selectedDate);
        return getCalculatedAvailableSlots(dateStr, selectedService);
    }, [selectedDate, selectedService, getCalculatedAvailableSlots]);

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedService || !selectedDate || !selectedTime || !currentUser) return;

        try {
            await addBookingRequest({
                service: selectedService,
                date: getLocalDateString(selectedDate),
                time: selectedTime,
                customerName: currentUser.name,
                customerEmail: currentUser.email,
                customerNotes: bookingNotes
            });

            alert(t('user.booking.successMessage', { serviceName: selectedService.name }));
            setSelectedService(null);
            setSelectedDate(null);
            setSelectedTime(null);
            setBookingNotes('');
            setViewMode('my-appointments');
        } catch (error) {
            console.error("Booking failed:", error);
            alert(t('user.booking.failureMessage'));
        }
    };

    const myBookings = useMemo(() => {
        if (!currentUser) return { upcoming: [], past: [], pending: [] };
        const email = currentUser.email.toLowerCase();
        const todayStart = new Date().setHours(0, 0, 0, 0);

        const sortChronological = (a: Booking, b: Booking) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;

            // Time comparison (HH:MM AM/PM)
            const toMinutes = (t: string) => {
                const [time, mod] = t.split(' ');
                let [h, m] = time.split(':').map(Number);
                if (mod === 'PM' && h < 12) h += 12;
                if (mod === 'AM' && h === 12) h = 0;
                return h * 60 + m;
            };
            return toMinutes(a.time) - toMinutes(b.time);
        };

        return {
            pending: bookingRequests
                .filter(b => b.customerEmail.toLowerCase() === email)
                .sort(sortChronological),
            upcoming: bookings
                .filter(b => b.customerEmail.toLowerCase() === email && new Date(b.date).getTime() >= todayStart)
                .sort(sortChronological),
            past: bookings
                .filter(b => b.customerEmail.toLowerCase() === email && new Date(b.date).getTime() < todayStart)
                .sort((a, b) => sortChronological(b, a)) // Past: Recent first (Descending)
        };
    }, [bookings, bookingRequests, currentUser]);

    const emailThreads = useMemo(() => {
        if (!currentUser) return [];
        const groups: Record<string, Message[]> = {};
        messages.filter(m => m.senderId === currentUser.id || m.recipientId === currentUser.id)
            .forEach(m => {
                if (!groups[m.threadId]) groups[m.threadId] = [];
                groups[m.threadId].push(m);
            });

        return Object.entries(groups).map(([id, msgs]) => ({
            id,
            subject: msgs[0].subject,
            messages: msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
            unread: msgs.some(m => m.recipientId === currentUser.id && !m.read)
        })).sort((a, b) => b.messages[b.messages.length - 1].timestamp.localeCompare(a.messages[a.messages.length - 1].timestamp));
    }, [messages, currentUser]);

    const activeThread = useMemo(() => emailThreads.find(t => t.id === selectedThreadId), [emailThreads, selectedThreadId]);

    // Auto-scroll logic for user messages
    useEffect(() => {
        if (userThreadScrollRef.current) {
            userThreadScrollRef.current.scrollTop = userThreadScrollRef.current.scrollHeight;
        }
    }, [activeThread]);

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedThreadId || !replyText.trim() || !currentUser || !activeThread) return;
        setIsSending(true);
        try {
            await sendMessage('owner-1', activeThread.subject, replyText, selectedThreadId);
            setReplyText('');
        } catch (error) {
            console.error("Failed to send reply:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendInquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubject.trim() || !newBody.trim() || !currentUser) return;
        setIsSending(true);
        try {
            await sendMessage('owner-1', newSubject, newBody);
            setNewSubject('');
            setNewBody('');
            alert(t('user.inquiries.sentSuccess'));
        } catch (error) {
            console.error("Failed to send inquiry:", error);
        } finally {
            setIsSending(false);
        }
    };

    const renderBooking = () => {
        if (!selectedService) {
            return (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-center text-gray-900 mb-8">{t('user.booking.selectService')}</h2>
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {services.map(s => (
                            <Card key={s.id} className="p-8 cursor-pointer hover:border-pink-500 hover:shadow-lg transition-all border-2" onClick={() => setSelectedService(s)}>
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">{t(`services.${s.id}.name`, s.name)}</h3>
                                    <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-black">${s.price}</span>
                                </div>
                                <p className="text-gray-600 text-sm mb-6 leading-relaxed">{t(`services.${s.id}.description`, s.description)}</p>
                                <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    <ClockIcon className="h-4 w-4 mr-2" /> {s.duration} {t('user.booking.minutes')}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }

        if (selectedTime) {
            return (
                <Card className="max-w-2xl mx-auto p-8 border-2">
                    <button onClick={() => setSelectedTime(null)} className="flex items-center text-pink-600 font-bold mb-6 hover:gap-1 transition-all">
                        <ChevronLeftIcon className="h-5 w-5 mr-1" /> {t('user.booking.backToTimes')}
                    </button>
                    <h3 className="text-2xl font-black mb-6">{t('user.booking.confirmRequest')}</h3>
                    <div className="bg-gray-50 p-6 rounded-2xl mb-6 space-y-4 border border-gray-200">
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{t('user.booking.service')}</span>
                            <span className="font-bold text-gray-900">{t(`services.${selectedService.id}.name`, selectedService.name)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{t('user.booking.date')}</span>
                            <span className="font-bold text-gray-900">{selectedDate?.toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{t('user.booking.time')}</span>
                            <span className="font-bold text-pink-600">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{t('user.booking.price')}</span>
                            <span className="font-black text-gray-900 text-lg">${selectedService.price}</span>
                        </div>
                    </div>
                    <form onSubmit={handleBookingSubmit} className="space-y-4">
                        <label className="block text-sm font-bold text-gray-700">{t('user.booking.notesLabel')}</label>
                        <textarea
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            placeholder={t('user.booking.notesPlaceholder')}
                            className="w-full p-4 border border-gray-300 rounded-xl min-h-[100px] focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                        />
                        <button type="submit" className="w-full bg-pink-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors">
                            {t('user.booking.sendRequest')}
                        </button>
                    </form>
                </Card>
            );
        }

        return (
            <div className="max-w-4xl mx-auto space-y-8">
                <button onClick={() => { setSelectedService(null); setSelectedDate(null); }} className="flex items-center text-pink-600 font-bold hover:gap-2 transition-all">
                    <ChevronLeftIcon className="h-5 w-5 mr-1" /> {t('user.booking.changeService')}
                </button>

                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-pink-500" />
                            {t('user.booking.selectDate')}
                        </h3>
                        <MonthlyCalendar
                            currentMonth={currentMonth}
                            setCurrentMonth={setCurrentMonth}
                            selectedDate={selectedDate || new Date()}
                            setSelectedDate={setSelectedDate}
                            bookings={bookings}
                            availability={availability}
                        />
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-300 shadow-sm">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-pink-500" />
                            {t('user.booking.availableTimes')}
                        </h3>
                        {selectedDate ? (
                            availableSlots.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {availableSlots.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className="py-3 px-4 border-2 border-pink-100 hover:border-pink-500 hover:bg-pink-50 text-pink-700 font-bold rounded-xl transition-all text-sm"
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-xl">
                                    <p className="font-bold">{t('user.booking.noSlots')}</p>
                                    <p className="text-xs">{t('user.booking.tryAnotherDay')}</p>
                                </div>
                            )
                        ) : (
                            <div className="py-12 text-center text-gray-400">
                                <p className="font-medium italic">{t('user.booking.selectDatePrompt')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderMyAppointments = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {myBookings.pending.length > 0 && (
                <section>
                    <h3 className="text-lg font-black text-gray-400 uppercase tracking-widest mb-4">{t('user.appointments.pending')}</h3>
                    <div className="grid gap-4">
                        {myBookings.pending.map(b => (
                            <Card key={b.id} className="p-6 border-l-4 border-l-yellow-400 flex justify-between items-center">
                                <div>
                                    <h4 className="font-black text-gray-900">{b.service.name}</h4>
                                    <p className="text-sm text-gray-500">{new Date(b.date).toLocaleDateString(i18n.language)} at {b.time} - {calculateEndTime(b.time, b.service.duration)}</p>
                                </div>
                                <span className="text-[10px] font-black uppercase px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">{t('user.appointments.awaitingOwner')}</span>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-lg font-black text-gray-900 mb-4">{t('user.appointments.upcoming')}</h3>
                <div className="grid gap-4">
                    {myBookings.upcoming.length > 0 ? myBookings.upcoming.map(b => (
                        <Card key={b.id} className="p-6 border-l-4 border-l-green-500 flex justify-between items-center shadow-lg">
                            <div className="flex items-start gap-4">
                                <div className="bg-green-50 p-3 rounded-xl">
                                    <CalendarIcon className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900">{b.service.name}</h4>
                                    <p className="text-sm text-gray-600">{new Date(b.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    <p className="text-pink-600 font-bold text-sm mt-1">{b.time} - {calculateEndTime(b.time, b.service.duration)} ({b.service.duration} min)</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 text-green-600 font-black text-xs uppercase">
                                    <CheckCircleIcon className="h-4 w-4" /> {t('user.appointments.confirmed')}
                                </div>
                                <button
                                    onClick={() => alert(t('cancelMessage'))}
                                    className="text-gray-400 hover:text-red-500 text-xs font-bold underline transition-colors"
                                >
                                    Cancel Listing
                                </button>
                            </div>
                        </Card>
                    )) : (
                        <div className="py-12 text-center bg-white rounded-2xl border border-gray-200 text-gray-400">
                            <p className="font-bold">{t('user.appointments.noUpcoming')}</p>
                        </div>
                    )}
                </div>
            </section>

            {myBookings.past.length > 0 && (
                <section>
                    <h3 className="text-lg font-black text-gray-400 uppercase tracking-widest mb-4">{t('user.appointments.history')}</h3>
                    <div className="grid gap-3 opacity-60">
                        {myBookings.past.map(b => (
                            <div key={b.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center text-sm">
                                <span className="font-bold text-gray-700">{b.service.name}</span>
                                <span className="text-gray-500">{new Date(b.date).toLocaleDateString(i18n.language)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );

    const handleOpenThread = (threadId: string) => {
        setSelectedThreadId(threadId);
        markThreadAsRead(threadId);
    };

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-12 bg-white p-1.5 rounded-full border border-gray-200 shadow-sm w-fit mx-auto">
                {[
                    { id: 'book', label: t('user.tabs.book') },
                    { id: 'my-appointments', label: t('user.tabs.appointments') },
                    { id: 'messages', label: t('user.tabs.inquiries'), count: emailThreads.filter(t => t.unread).length },
                    { id: 'profile', label: t('user.tabs.profile') }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className={`relative px-4 sm:px-8 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${viewMode === tab.id ? 'bg-pink-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow-sm ring-2 ring-white">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {viewMode === 'book' && renderBooking()}
            {viewMode === 'my-appointments' && renderMyAppointments()}
            {viewMode === 'messages' && (
                <div className="grid lg:grid-cols-3 gap-6 h-[650px]">
                    <Card className={`lg:col-span-1 flex-col bg-gray-50/50 ${selectedThreadId ? 'hidden lg:flex' : 'flex'}`}>
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
                            <h2 className="font-black text-gray-900">{t('user.inquiries.conversations')}</h2>
                            <button onClick={() => setSelectedThreadId(null)} className="text-pink-600 hover:bg-pink-50 p-1 rounded-full"><PlusCircleIcon className="h-6 w-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {emailThreads.map(thread => (
                                <button
                                    key={thread.id}
                                    onClick={() => handleOpenThread(thread.id)}
                                    className={`w-full text-left p-4 border-b border-gray-100 transition-all ${selectedThreadId === thread.id ? 'bg-white border-l-4 border-l-pink-600 shadow-sm' : 'hover:bg-white'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black text-gray-400 uppercase">{t('user.inquiries.salonOwner')}</span>
                                        {thread.unread && <span className="h-2 w-2 bg-pink-600 rounded-full"></span>}
                                    </div>
                                    <p className={`text-sm truncate ${thread.unread ? 'font-black text-black' : 'text-gray-600'}`}>{thread.subject}</p>
                                </button>
                            ))}
                            {emailThreads.length === 0 && (
                                <div className="p-8 text-center text-gray-400">
                                    <p className="text-xs italic font-medium">{t('user.inquiries.noMessages')}</p>
                                </div>
                            )}
                        </div>
                    </Card>
                    <Card className={`lg:col-span-2 flex-col bg-white overflow-hidden ${!selectedThreadId ? 'hidden lg:flex' : 'flex'}`}>
                        {selectedThreadId && activeThread ? (
                            <>
                                <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedThreadId(null)} className="lg:hidden text-gray-400 mr-2 hover:bg-gray-100 p-1 rounded-full"><ChevronLeftIcon className="h-6 w-6" /></button>
                                        <h2 className="text-xl font-bold truncate max-w-[200px] sm:max-w-md">{activeThread.subject}</h2>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Delete conversation?")) {
                                                await deleteThread(selectedThreadId);
                                                setSelectedThreadId(null);
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete Thread"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/20" ref={userThreadScrollRef}>
                                    {activeThread.messages.map(msg => (
                                        <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser?.id ? 'items-end' : 'items-start'}`}>
                                            <div className={`relative group max-w-[85%] p-4 rounded-2xl shadow-sm border ${msg.senderId === currentUser?.id ? 'bg-pink-600 text-white border-pink-700' : 'bg-white text-gray-800 border-gray-200'}`}>
                                                <div className="flex justify-between text-[9px] font-bold uppercase opacity-60 mb-2">
                                                    <span>{msg.senderId === currentUser?.id ? t('user.inquiries.you') : t('user.inquiries.laura')}</span>
                                                    <span className="ml-4">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>

                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm("Delete message?")) {
                                                            await deleteMessage(msg.id);
                                                        }
                                                    }}
                                                    className={`absolute -top-2 ${msg.senderId === currentUser?.id ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 p-1.5 bg-red-100 text-red-600 rounded-full shadow-md transition-all scale-90 hover:scale-110`}
                                                    title="Delete Message"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSendReply} className="p-5 border-t border-gray-200 bg-white">
                                    <div className="flex gap-3 items-end">
                                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('user.inquiries.writeReply')} className="flex-1 p-3 border border-gray-300 rounded-xl text-sm min-h-[50px] max-h-[150px] resize-none focus:ring-2 focus:ring-pink-500 outline-none" />
                                        <button type="submit" disabled={isSending || !replyText.trim()} className="bg-pink-600 text-white p-3 rounded-xl font-bold flex items-center justify-center h-[46px] w-[46px] transition-transform active:scale-95 disabled:opacity-50 shadow-md">
                                            <PaperAirplaneIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 p-8 overflow-y-auto">
                                <h3 className="text-xl font-black mb-6">{t('user.inquiries.newInquiry')}</h3>
                                <form onSubmit={handleSendInquiry} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t('user.inquiries.subject')}</label>
                                        <input type="text" placeholder={t('user.inquiries.subjectPlaceholder')} value={newSubject} onChange={e => setNewSubject(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t('user.inquiries.message')}</label>
                                        <textarea placeholder={t('user.inquiries.messagePlaceholder')} value={newBody} onChange={e => setNewBody(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl min-h-[180px] focus:ring-2 focus:ring-pink-500 outline-none" />
                                    </div>
                                    <button type="submit" disabled={isSending} className="w-full bg-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors">{isSending ? t('user.inquiries.sending') : t('user.inquiries.sendMessage')}</button>
                                </form>
                            </div>
                        )}
                    </Card>
                </div>
            )}
            {viewMode === 'profile' && (
                <Card className="max-w-md mx-auto p-12 text-center border-2">
                    <div className="h-24 w-24 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 mx-auto mb-6">
                        <UserCircleIcon className="h-16 w-16" />
                    </div>

                    {!isEditing ? (
                        <>
                            <h2 className="text-2xl font-black text-gray-900 mb-2">{currentUser?.name}</h2>
                            <p className="text-gray-500 font-medium mb-2">{currentUser?.email}</p>
                            {currentUser?.phoneNumber && <p className="text-gray-500 text-sm mb-6">{currentUser.phoneNumber}</p>}

                            <button
                                onClick={() => {
                                    setEditName(currentUser?.name || '');
                                    setEditPhone(currentUser?.phoneNumber || '');
                                    setIsEditing(true);
                                }}
                                className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-full transition-colors text-sm"
                            >
                                {t('user.profile.editProfile')}
                            </button>
                        </>
                    ) : (
                        <div className="text-left space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t('user.profile.name')}</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t('user.profile.mobile')}</label>
                                <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    placeholder={t('auth.placeholderPhone')}
                                    className="w-full p-3 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('user.profile.email')}</label>
                                <input
                                    type="email"
                                    value={currentUser?.email}
                                    disabled
                                    className="w-full p-3 border border-gray-100 bg-gray-50 rounded-xl text-gray-400 cursor-not-allowed"
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
                                >
                                    {t('user.profile.cancel')}
                                </button>
                                <button
                                    onClick={async () => {
                                        await updateUserProfile(editName, currentUser?.photo || '', editPhone);
                                        setIsEditing(false);
                                    }}
                                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
                                >
                                    {t('user.profile.save')}
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default UserView;
