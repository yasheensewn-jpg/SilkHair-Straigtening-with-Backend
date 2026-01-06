import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Message, Client, Booking } from '../types';
import Card from './ui/Card';
import { MailIcon, PhoneIcon, CalendarIcon, ClockIcon, CutIcon, CheckCircleIcon, ChevronLeftIcon, UserCircleIcon, PaperAirplaneIcon, TrashIcon, UsersIcon, SparklesIcon, PlusCircleIcon } from './icons/Icons';
import MonthlyCalendar from './MonthlyCalendar';
import DayPreview from './DayPreview';
import AvailabilityManager from './AvailabilityManager';
import AIAssistant from './AIAssistant';
import CancellationModal from './CancellationModal';
import { useTranslation } from 'react-i18next';
import { getLocalDateString } from '../utils/dateUtils';

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
        updateClientNotes,
        deleteMessage,
        deleteThread,
        updateAvailabilitySlots,
        declineBookingRequest,
        getCalculatedAvailableSlots
    } = useAppContext();
    const { t, i18n } = useTranslation();

    const [currentTab, setCurrentTab] = useState<'schedule' | 'requests' | 'clients' | 'messages' | 'ai'>('schedule');
    const [scheduleSubTab, setScheduleSubTab] = useState<'view' | 'availability' | 'manual'>('view');

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const [cancellationBooking, setCancellationBooking] = useState<Booking | null>(null);

    // Manual Booking Form State
    const [manualForm, setManualForm] = useState({
        serviceId: services[0]?.id || '',
        customerName: '',
        customerEmail: '',
        time: '09:00 AM',
        date: getLocalDateString(new Date()),
        customDescription: '',
        customStartTime: '09:00',
        customEndTime: '10:00',
        sendEmail: false,
        useExistingAvailability: true
    });

    // Date Picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Close date picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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

    // Email Toggle State
    const [sendEmailOnAction, setSendEmailOnAction] = useState(true);

    const selectedDateStr = getLocalDateString(selectedDate);

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

    // Helper to convert "HH:MM" (24-hour) to minutes from midnight
    const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Helper to convert minutes from midnight to "HH:MM AM/PM" format
    const minutesToTime = (totalMinutes: number): string => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    const handleManualBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let serviceToBook: any = services.find(s => s.id === manualForm.serviceId);
        let timeToBook = manualForm.time;
        // Logic for "Other"
        if (manualForm.serviceId === 'other') {
            // Validate time
            const startMinutes = timeToMinutes(manualForm.customStartTime);
            const endMinutes = timeToMinutes(manualForm.customEndTime);

            if (endMinutes <= startMinutes) {
                alert('End time must be after start time.');
                return;
            }

            const duration = endMinutes - startMinutes;
            serviceToBook = {
                id: 'custom-' + Date.now(),
                name: `Other: ${manualForm.customDescription || 'Custom Service'}`,
                duration: duration,
                price: 0 // Optional or prompt
            };

            // Convert 24h customStartTime back to AM/PM for standard storage if needed, or keeping it as is.
            // The system uses "09:00 AM" format usually. Let's convert if needed.
            // However, addManualBooking takes 'time'.
            timeToBook = minutesToTime(startMinutes);
        }
        // Logic for Standard Services
        if (!serviceToBook) return;

        let source: 'manual' | 'online' = 'manual';

        if (manualForm.serviceId === 'other') {
            source = 'manual';
        } else {
            // Standard Service
            if (manualForm.useExistingAvailability) {
                source = 'online'; // Block slots
            } else {
                source = 'manual'; // Override (Invisible)
                // Ensure duration is standard (already set by serviceToBook)
                // Start time is set by TimePicker
            }
        }

        await addManualBooking({
            service: serviceToBook,
            date: manualForm.date,
            time: timeToBook,
            customerName: manualForm.customerName,
            customerEmail: manualForm.customerEmail,
            ownerNotes: 'Manual Booking',
            source: source
        });

        // 1. Send In-App Message (Always try to find registered client)
        const recipientClient = clients.find(c => c.email.toLowerCase() === manualForm.customerEmail.toLowerCase());
        if (recipientClient) {
            const messageSubject = t('owner.schedule.emailSubject');
            const messageBody = t('owner.schedule.emailBody', {
                name: manualForm.customerName,
                service: serviceToBook.name,
                date: new Date(manualForm.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }),
                time: timeToBook
            });
            // Send in-app message
            await sendMessage(recipientClient.id, messageSubject, messageBody);
        }

        // 2. Open External Email (If toggled)
        if (manualForm.sendEmail) {
            const subject = encodeURIComponent(t('owner.schedule.emailSubject'));
            const bodyContent = t('owner.schedule.emailBody', {
                name: manualForm.customerName,
                service: serviceToBook.name,
                date: new Date(manualForm.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }),
                time: timeToBook
            });
            const body = encodeURIComponent(bodyContent);
            window.location.href = `mailto:${manualForm.customerEmail}?subject=${subject}&body=${body}`;
        }

        alert(t('owner.schedule.bookingAdded'));
        setManualForm({ ...manualForm, customerName: '', customerEmail: '', customDescription: '', serviceId: services[0]?.id || '', sendEmail: false });
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
        const subject = encodeURIComponent(t('owner.requests.emailSubject'));
        const bodyContent = t('owner.requests.emailBody', {
            name: req.customerName,
            service: req.service.name,
            date: new Date(req.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
            time: req.time
        });
        const body = encodeURIComponent(bodyContent);

        // Open owner's system email client
        if (sendEmailOnAction) {
            window.location.href = `mailto:${req.customerEmail}?subject=${subject}&body=${body}`;
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        const req = bookingRequests.find(r => r.id === requestId);
        if (!req) return;

        if (window.confirm("Are you sure you want to decline this booking request?")) {
            await declineBookingRequest(requestId); // Assuming this is destructured from context

            if (sendEmailOnAction) {
                const subject = encodeURIComponent(t('owner.requests.rejectionSubject'));
                const bodyContent = t('owner.requests.rejectionBody', {
                    name: req.customerName,
                    service: req.service.name,
                    date: new Date(req.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }),
                    time: req.time
                });
                const body = encodeURIComponent(bodyContent);
                window.location.href = `mailto:${req.customerEmail}?subject=${subject}&body=${body}`;
            }
        }
    };


    const handleFinalizeCancellation = async (shouldReleaseSlot: boolean) => {
        if (!cancellationBooking) return;
        const booking = cancellationBooking;

        // 1. Prepare Email
        const messageSubject = t('owner.cancellation.emailSubject');
        const messageBody = t('owner.cancellation.emailBody', {
            name: booking.customerName,
            service: booking.service.name,
            date: booking.date,
            time: booking.time
        });

        // 2. Send In-App Message
        const client = clients.find(c => c.email.toLowerCase() === booking.customerEmail.toLowerCase());
        if (client) {
            await sendMessage(client.id, messageSubject, messageBody);
        }

        // 3. Perform Cancellation
        await cancelBooking(booking.id);

        // 4. Update Availability (Release vs Block)
        const currentSlots = availability[booking.date] || [];

        let slotTime24 = booking.time;
        // Check if we need to convert to 24h format (AvailabilityManager standard)
        // Heuristic: If existing slots use 24h (no 'M'), or if list is empty (default to 24h)
        const looksLike24h = currentSlots.length === 0 || currentSlots.some(s => !s.includes('M'));

        if (looksLike24h && booking.time.includes('M')) {
            try {
                const d = new Date(`2000/01/01 ${booking.time}`);
                const h = String(d.getHours()).padStart(2, '0');
                const m = String(d.getMinutes()).padStart(2, '0');
                slotTime24 = `${h}:${m}`;
            } catch (e) {
                console.error("Time conversion error", e);
            }
        }

        let newSlots = [...currentSlots];

        if (shouldReleaseSlot) {
            // Add slot if missing
            if (!newSlots.includes(slotTime24)) {
                newSlots.push(slotTime24);
                // Simple string sort works for "09:00", "14:00"
                newSlots.sort();
                await updateAvailabilitySlots(booking.date, newSlots);
            }
        } else {
            // Block (Remove) slot if present
            if (newSlots.includes(slotTime24)) {
                newSlots = newSlots.filter(s => s !== slotTime24);
                await updateAvailabilitySlots(booking.date, newSlots);
            }
        }

        // 5. Cleanup UI
        setCancellationBooking(null);

        // 6. Open Email Client
        const subject = encodeURIComponent(messageSubject);
        const body = encodeURIComponent(messageBody);
        window.location.href = `mailto:${booking.customerEmail}?subject=${subject}&body=${body}`;
    };




    const handleUpdateBookingNotes = async (booking: Booking) => {
        const newNotes = window.prompt(t('owner.actions.ownerNotesPrompt'), booking.ownerNotes || "");
        if (newNotes !== null) {
            await updateBooking(booking.id, { ownerNotes: newNotes });
        }
    };

    const handleSaveClientNote = async (clientId: string) => {
        const notes = editingClientNotes[clientId];
        if (notes !== undefined) {
            await updateClientNotes(clientId, notes);
            alert(t('owner.clients.successNotes'));
        }
    };

    const renderScheduleTabs = () => (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-gray-200">
                {[
                    { id: 'view', label: t('owner.schedule.appointments') },
                    { id: 'availability', label: t('owner.schedule.availability') },
                    { id: 'manual', label: t('owner.schedule.addBooking') }
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
                            onCancelBooking={(bookingId) => {
                                const booking = bookings.find(b => b.id === bookingId);
                                if (booking) setCancellationBooking(booking);
                            }}
                        />
                    </div>
                </div>
            )}

            {scheduleSubTab === 'availability' && <AvailabilityManager />}

            {scheduleSubTab === 'manual' && (
                <Card className="max-w-2xl mx-auto p-8 border-2">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                        <PlusCircleIcon className="h-6 w-6 text-pink-600" />
                        {t('owner.schedule.manualBookingTitle')}
                    </h3>
                    <form onSubmit={handleManualBookingSubmit} className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{t('owner.schedule.registeredClient')}</label>
                            <select
                                onChange={(e) => handleClientSelectForManual(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none text-sm"
                            >
                                <option value="">{t('owner.schedule.selectClient')}</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.schedule.customerName')}</label>
                                <input type="text" required value={manualForm.customerName} onChange={e => setManualForm({ ...manualForm, customerName: e.target.value })} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.schedule.customerEmail')}</label>
                                <input type="email" required value={manualForm.customerEmail} onChange={e => setManualForm({ ...manualForm, customerEmail: e.target.value })} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative" ref={datePickerRef}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.schedule.date')}</label>
                                <div
                                    className="w-full p-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-pink-500 bg-white flex items-center justify-between cursor-pointer"
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                >
                                    <span>{new Date(manualForm.date).toLocaleDateString(i18n.language, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                {showDatePicker && (
                                    <div className="absolute top-full left-0 z-50 mt-2 w-full sm:w-[350px] shadow-2xl rounded-xl overflow-hidden">
                                        <MonthlyCalendar
                                            currentMonth={new Date(manualForm.date)}
                                            setCurrentMonth={(d) => setManualForm({ ...manualForm, date: getLocalDateString(d) })} // Assuming currentMonth update isn't strictly needed for state, but navigating helps
                                            selectedDate={new Date(manualForm.date)}
                                            setSelectedDate={(d) => {
                                                setManualForm({ ...manualForm, date: getLocalDateString(d) });
                                                setShowDatePicker(false);
                                            }}
                                            bookings={[]} // Don't show bookings, focus on availability
                                            availability={manualForm.useExistingAvailability ? availability : {}}
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.schedule.time')}</label>
                                {manualForm.serviceId !== 'other' && manualForm.useExistingAvailability ? (
                                    <select
                                        required
                                        value={manualForm.time}
                                        onChange={e => setManualForm({ ...manualForm, time: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                                    >
                                        <option value="">{t('owner.schedule.selectSlot')}</option>
                                        {getCalculatedAvailableSlots(manualForm.date, services.find(s => s.id === manualForm.serviceId)!).map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input type="text" placeholder="09:00 AM" required value={manualForm.time} onChange={e => setManualForm({ ...manualForm, time: e.target.value })} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
                                )}
                            </div>
                        </div>

                        {manualForm.serviceId !== 'other' && (
                            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-200">
                                <div
                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out ${manualForm.useExistingAvailability ? 'bg-blue-600' : 'bg-gray-300'}`}
                                    onClick={() => setManualForm({ ...manualForm, useExistingAvailability: !manualForm.useExistingAvailability })}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${manualForm.useExistingAvailability ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-sm font-bold text-gray-600">{t('owner.schedule.bookWithinAvailability')}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('owner.schedule.service')}</label>
                                <select
                                    value={manualForm.serviceId}
                                    onChange={(e) => setManualForm({ ...manualForm, serviceId: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-pink-500 outline-none appearance-none bg-white"
                                >
                                    {services.map(service => (
                                        <option key={service.id} value={service.id}>{service.name}</option>
                                    ))}
                                    <option value="other">{t('owner.schedule.otherService')}</option>
                                </select>
                            </div>

                            {manualForm.serviceId === 'other' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('owner.schedule.description')}</label>
                                        <input
                                            type="text"
                                            value={manualForm.customDescription}
                                            onChange={(e) => setManualForm({ ...manualForm, customDescription: e.target.value })}
                                            placeholder="e.g. Consultation"
                                            className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('owner.schedule.startTime')}</label>
                                            <select
                                                value={manualForm.customStartTime}
                                                onChange={(e) => setManualForm({ ...manualForm, customStartTime: e.target.value })}
                                                className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                                            >
                                                {Array.from({ length: 48 }).map((_, i) => {
                                                    const h = Math.floor(i / 2);
                                                    const m = i % 2 === 0 ? '00' : '30';
                                                    const time = `${String(h).padStart(2, '0')}:${m}`;
                                                    return <option key={time} value={time}>{time}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('owner.schedule.endTime')}</label>
                                            <select
                                                value={manualForm.customEndTime}
                                                onChange={(e) => setManualForm({ ...manualForm, customEndTime: e.target.value })}
                                                className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                                            >
                                                {Array.from({ length: 48 }).map((_, i) => {
                                                    const h = Math.floor(i / 2);
                                                    const m = i % 2 === 0 ? '00' : '30';
                                                    const time = `${String(h).padStart(2, '0')}:${m}`;
                                                    return <option key={time} value={time}>{time}</option>;
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                <div
                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out ${manualForm.sendEmail ? 'bg-pink-600' : 'bg-gray-300'}`}
                                    onClick={() => setManualForm({ ...manualForm, sendEmail: !manualForm.sendEmail })}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${manualForm.sendEmail ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-sm font-bold text-gray-600">{t('owner.schedule.sendEmail')}</span>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                            >
                                <PlusCircleIcon className="h-5 w-5" />
                                {t('owner.schedule.confirmAppointment')}
                            </button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );

    const renderMessages = () => (
        <div className="max-w-7xl mx-auto shadow-xl rounded-2xl overflow-hidden flex bg-white border border-gray-200 h-[700px]">
            {/* Sidebar Inbox */}
            <div className={`w-full lg:w-80 border-r border-gray-200 flex-col bg-gray-50/50 ${selectedThreadId || isComposing ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-900">{t('owner.inbox.title')}</h2>
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
                            <div key={thread.id} className={`w-full flex items-center border-b border-gray-100 transition-all ${isActive ? 'bg-white border-l-4 border-l-pink-600 shadow-sm' : 'hover:bg-gray-100'}`}>
                                <button
                                    onClick={() => handleSelectThread(thread.id)}
                                    className="flex-1 text-left p-4 pr-1"
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className={`text-sm ${thread.unreadCount > 0 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                            {thread.client?.name || 'Inquiry'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">
                                            {new Date(lastMsg.timestamp).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate ${thread.unreadCount > 0 ? 'font-bold text-black' : 'text-gray-600'}`}>
                                        {lastMsg.subject}
                                    </p>
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm("Are you sure you want to delete this entire conversation? This cannot be undone.")) {
                                            await deleteThread(thread.id);
                                            if (selectedThreadId === thread.id) setSelectedThreadId(null);
                                        }
                                    }}
                                    className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors mr-2 flex-shrink-0"
                                    title="Delete Conversation"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Email Pane */}
            <div className={`flex-1 flex-col bg-white ${!selectedThreadId && !isComposing ? 'hidden lg:flex' : 'flex'}`}>
                {isComposing ? (
                    <div className="p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <button
                                onClick={() => setIsComposing(false)}
                                className="lg:hidden text-gray-400 hover:bg-gray-100 p-1 rounded-full"
                            >
                                <ChevronLeftIcon className="h-6 w-6" />
                            </button>
                            <h3 className="text-xl font-black">{t('owner.inbox.compose')}</h3>
                        </div>
                        <form onSubmit={handleComposeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.inbox.recipient')}</label>
                                <select
                                    required
                                    value={composeRecipientId}
                                    onChange={e => setComposeRecipientId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                >
                                    <option value="">{t('owner.inbox.selectClient')}</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.inbox.subject')}</label>
                                <input
                                    type="text"
                                    required
                                    value={composeSubject}
                                    onChange={e => setComposeSubject(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                    placeholder={t('owner.inbox.subjectPlaceholder')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('owner.inbox.message')}</label>
                                <textarea
                                    required
                                    value={composeBody}
                                    onChange={e => setComposeBody(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl min-h-[200px] focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                                    placeholder={t('owner.inbox.messagePlaceholder')}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSending}
                                className="w-full bg-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors"
                            >
                                {isSending ? t('owner.inbox.sending') : t('owner.inbox.sendMessage')}
                            </button>
                        </form>
                    </div>
                ) : activeThread ? (
                    <>
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                            <div className="flex-1 flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedThreadId(null)}
                                    className="lg:hidden text-gray-400 hover:bg-gray-100 p-1 rounded-full mr-2"
                                >
                                    <ChevronLeftIcon className="h-6 w-6" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2 truncate max-w-[200px] sm:max-w-md">
                                        {activeThread.messages[0].subject}
                                    </h2>
                                    <div className="text-sm text-gray-500">From: <span className="font-bold text-gray-800">{activeThread.client?.name || 'Unknown'}</span></div>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (selectedThreadId && window.confirm("Are you sure you want to delete this entire conversation? This cannot be undone.")) {
                                        await deleteThread(selectedThreadId);
                                        setSelectedThreadId(null);
                                    }
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
                                title="Delete Conversation"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30" ref={threadScrollRef}>
                            {activeThread.messages.map((msg) => (
                                <div key={msg.id} className={`flex flex-col ${msg.senderId === 'owner-1' ? 'items-end' : 'items-start'}`}>
                                    <div className={`relative group max-w-[80%] p-5 rounded-2xl shadow-sm border ${msg.senderId === 'owner-1' ? 'bg-pink-600 text-white border-pink-700' : 'bg-white text-gray-800 border-gray-200'}`}>
                                        <div className="flex justify-between items-center mb-2 text-[10px] font-bold uppercase opacity-60">
                                            <span>{msg.senderId === 'owner-1' ? 'You' : msg.senderName}</span>
                                            <span className="ml-4">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</div>

                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (window.confirm("Delete this message?")) {
                                                    await deleteMessage(msg.id);
                                                }
                                            }}
                                            className={`absolute -top-2 ${msg.senderId === 'owner-1' ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 p-1.5 bg-red-100 text-red-600 rounded-full shadow-md transition-all scale-90 hover:scale-110`}
                                            title="Delete Message"
                                        >
                                            <TrashIcon className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-gray-200 bg-white">
                            <form onSubmit={handleSendReply}>
                                <div className="flex gap-4 items-end">
                                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('owner.inbox.writeReply')} className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none text-sm min-h-[80px] max-h-[200px] resize-none" />
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
                        <p className="font-bold">{t('owner.inbox.selectInquiry')}</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2 bg-gray-200 p-1 rounded-xl shadow-inner">
                {[
                    { id: 'schedule', label: t('owner.tabs.schedule'), icon: CalendarIcon, badge: 0 },
                    { id: 'requests', label: t('owner.tabs.requests'), icon: ClockIcon, badge: bookingRequests.length },
                    { id: 'clients', label: t('owner.tabs.clients'), icon: UsersIcon, badge: 0 },
                    { id: 'messages', label: t('owner.tabs.inbox'), icon: MailIcon, badge: unreadMessagesCount },
                    { id: 'ai', label: t('owner.ai.title'), icon: SparklesIcon, badge: 0 }
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
            {currentTab === 'ai' && <AIAssistant />}

            {currentTab === 'requests' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-gray-900">{t('owner.requests.pendingTitle')}</h2>
                            <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-black">{bookingRequests.length} {t('owner.requests.total')}</span>
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('owner.requests.emailToggle')}</span>
                            <button
                                onClick={() => setSendEmailOnAction(!sendEmailOnAction)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${sendEmailOnAction ? 'bg-pink-600' : 'bg-gray-300'}`}
                                title="Toggle Email Notifications"
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${sendEmailOnAction ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
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
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDeclineRequest(r.id)}
                                    className="bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 px-4 py-2 rounded-xl text-sm font-black shadow-sm transition-all active:scale-95"
                                >
                                    {sendEmailOnAction ? t('owner.requests.declineEmail') : t('owner.requests.decline')}
                                </button>
                                <button
                                    onClick={() => handleApproveRequest(r.id)}
                                    className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-xl text-sm font-black shadow-md transition-all active:scale-95"
                                >
                                    {sendEmailOnAction ? t('owner.requests.approveEmail') : t('owner.schedule.confirmAppointment')}
                                </button>
                            </div>
                        </Card>
                    )) : (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-inner">
                            <ClockIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold">{t('owner.requests.noPending')}</p>
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
                                    {c.phoneNumber && (
                                        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded w-fit">
                                            <PhoneIcon className="h-3 w-3" />
                                            <a href={`tel:${c.phoneNumber}`} className="hover:text-pink-600 transition-colors">
                                                {c.phoneNumber}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('owner.clients.privateNotes')}</label>
                                <textarea
                                    value={editingClientNotes[c.id] ?? c.ownerNotes ?? ''}
                                    onChange={(e) => setEditingClientNotes({ ...editingClientNotes, [c.id]: e.target.value })}
                                    placeholder={t('owner.clients.placeholderNotes')}
                                    className="w-full text-xs p-3 bg-yellow-50 border border-yellow-200 rounded-xl focus:ring-1 focus:ring-yellow-400 outline-none resize-none min-h-[80px]"
                                />
                                <button
                                    onClick={() => handleSaveClientNote(c.id)}
                                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-yellow-700 hover:text-yellow-800 bg-yellow-100 px-3 py-1 rounded-full transition-colors self-end"
                                >
                                    <CheckCircleIcon className="h-3 w-3" /> {t('owner.clients.saveNotes')}
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <CancellationModal
                isOpen={!!cancellationBooking}
                booking={cancellationBooking}
                onClose={() => setCancellationBooking(null)}
                onConfirm={handleFinalizeCancellation}
            />
        </div>
    );
};

export default OwnerView;
