import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Card from './ui/Card';
import { ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon, TrashIcon, CheckCircleIcon } from './icons/Icons';
import { useTranslation } from 'react-i18next';
import { getLocalDateString } from '../utils/dateUtils';

// Generate 24h time slots in 30-minute increments
const generateTimeSlots = (): string[] => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        slots.push(`${hour}:00`);
        slots.push(`${hour}:30`);
    }
    return slots;
};

const TIME_SLOTS = generateTimeSlots();
const DEFAULT_AVAILABILITY_KEY = 'silky_default_avail_ranges_v2';

const AvailabilityManager: React.FC = () => {
    const {
        overwriteAvailabilityForDates,
        availability,
        bookings,
        bookingRequests,
        clearAvailabilityForDates
    } = useAppContext();
    const { t } = useTranslation();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState<string[]>([]);

    // Load default ranges from storage or fallback to 09:00 - 18:00
    const [defaultRanges, setDefaultRanges] = useState<{ start: string, end: string }[]>(() => {
        try {
            const stored = localStorage.getItem(DEFAULT_AVAILABILITY_KEY);
            return stored ? JSON.parse(stored) : [{ start: '09:00', end: '18:00' }];
        } catch {
            return [{ start: '09:00', end: '18:00' }];
        }
    });

    const [timeRanges, setTimeRanges] = useState<{ start: string, end: string }[]>(defaultRanges);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const selectionStarted = useRef(false);

    const calendarData = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        const dates: (Date | null)[] = Array(startDayOfWeek).fill(null);
        for (let i = 1; i <= daysInMonth; i++) dates.push(new Date(year, month, i));
        return { dates, monthName: firstDay.toLocaleString('default', { month: 'long' }), year };
    }, [currentMonth]);

    const handleDayClick = (dateStr: string) => {
        setSelectedDays(prev => {
            if (prev.includes(dateStr)) return prev.filter(d => d !== dateStr);
            return [...prev, dateStr].sort();
        });
    };

    useEffect(() => {
        if (selectedDays.length > 0 && !selectionStarted.current) {
            selectionStarted.current = true;
            setTimeRanges(defaultRanges);
        } else if (selectedDays.length === 0) {
            selectionStarted.current = false;
        }
    }, [selectedDays, defaultRanges]);

    const handleAddRange = () => setTimeRanges([...timeRanges, { start: '09:00', end: '18:00' }]);
    const handleRemoveRange = (index: number) => setTimeRanges(timeRanges.filter((_, i) => i !== index));
    const handleRangeChange = (index: number, field: 'start' | 'end', value: string) => {
        const newRanges = [...timeRanges];
        newRanges[index][field] = value;
        setTimeRanges(newRanges);
    };

    const checkConflicts = () => {
        return selectedDays.some(date =>
            bookings.some(b => b.date === date) ||
            bookingRequests.some(r => r.date === date)
        );
    };

    const handleSave = async () => {
        if (selectedDays.length === 0) return;

        if (checkConflicts() && timeRanges.length === 0) {
            const proceed = window.confirm(
                "Warning: You are clearing availability for dates that currently have appointments. " +
                "Confirmed appointments will REMAIN booked until manually cancelled. Proceed?"
            );
            if (!proceed) return;
        } else if (checkConflicts()) {
            const proceed = window.confirm(
                "Warning: Some selected dates have existing appointments or requests. " +
                "Changing availability will NOT cancel existing bookings. " +
                "You must manage those manually. Proceed?"
            );
            if (!proceed) return;
        }

        setIsSaving(true);
        await overwriteAvailabilityForDates(selectedDays, timeRanges);

        if (timeRanges.length > 0) {
            setDefaultRanges(timeRanges);
            localStorage.setItem(DEFAULT_AVAILABILITY_KEY, JSON.stringify(timeRanges));
        }

        setIsSaving(false);
        setShowConfirmation(true);

        setTimeout(() => {
            setShowConfirmation(false);
            setSelectedDays([]);
        }, 1200);
    };

    const handleClearAvailability = async () => {
        if (selectedDays.length === 0) return;

        const hasConflicts = checkConflicts();
        const confirmMessage = hasConflicts
            ? t('owner.availability.confirmClearWithConflicts')
            : t('owner.availability.confirmClear');

        if (window.confirm(confirmMessage)) {
            setIsSaving(true);
            await clearAvailabilityForDates(selectedDays);
            setIsSaving(false);
            alert(t('owner.availability.cleared'));
            setSelectedDays([]);
        }
    };

    return (
        <Card className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2 rounded-full hover:bg-gray-200 text-black transition-colors"><ChevronLeftIcon className="h-5 w-5" /></button>
                    <h3 className="text-lg font-bold text-black">{calendarData.monthName} {calendarData.year}</h3>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2 rounded-full hover:bg-gray-200 text-black transition-colors"><ChevronRightIcon className="h-5 w-5" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold text-gray-800 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarData.dates.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`}></div>;
                        // Construct key mathematically to avoid timezone shifts
                        const d = date.getDate();
                        const m = date.getMonth() + 1;
                        const y = date.getFullYear();
                        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                        const isSelected = selectedDays.includes(dateStr);
                        const hasAvail = (availability[dateStr] || []).length > 0;
                        const hasBookings = bookings.some(b => b.date === dateStr) || bookingRequests.some(r => r.date === dateStr);

                        // Disable past dates
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPast = date < today;

                        let btnClass = 'h-10 w-10 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center relative font-bold ';
                        if (isPast) {
                            btnClass += 'opacity-30 cursor-not-allowed bg-gray-50 text-gray-400 border border-gray-100';
                        } else if (isSelected) {
                            btnClass += 'bg-pink-600 text-white shadow-lg';
                        } else {
                            btnClass += 'bg-white border border-gray-200 hover:bg-pink-100 text-gray-900';
                        }

                        return (
                            <button
                                key={dateStr}
                                onClick={() => !isPast && handleDayClick(dateStr)}
                                disabled={isPast}
                                className={btnClass}
                            >
                                {date.getDate()}
                                {hasAvail && !isSelected && !isPast && (
                                    <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${hasBookings ? 'bg-indigo-500' : 'bg-green-500'}`}></span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 flex gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1"><span className="h-2 w-2 bg-green-500 rounded-full"></span> Available</div>
                    <div className="flex items-center gap-1"><span className="h-2 w-2 bg-indigo-500 rounded-full"></span> Has Bookings</div>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-bold text-black mb-2">Selected Dates</h3>
                {selectedDays.length > 0 ? (
                    <div className="mb-4 text-sm text-pink-800 font-bold bg-pink-50 border border-pink-200 p-3 rounded-lg">
                        {selectedDays.length === 1 ? new Date(selectedDays[0]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : `${selectedDays.length} dates selected`}
                    </div>
                ) : (
                    <p className="text-sm text-gray-600 mb-4 font-medium">Select dates from the calendar to set hours.</p>
                )}

                {selectedDays.length > 0 && (
                    <>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-black">Available Hours</h3>
                        </div>

                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 mb-4">
                            {timeRanges.map((range, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-300 rounded-lg">
                                    <div className="grid grid-cols-2 gap-2 flex-1">
                                        <div className="relative">
                                            <select
                                                value={range.start}
                                                onChange={e => handleRangeChange(index, 'start', e.target.value)}
                                                className="w-full p-2 border border-gray-400 rounded-md text-sm bg-white text-black font-medium appearance-none cursor-pointer"
                                            >
                                                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={range.end}
                                                onChange={e => handleRangeChange(index, 'end', e.target.value)}
                                                className="w-full p-2 border border-gray-400 rounded-md text-sm bg-white text-black font-medium appearance-none cursor-pointer"
                                            >
                                                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveRange(index)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Remove row">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-4">
                            <button onClick={handleAddRange} className="text-sm flex items-center gap-2 text-pink-700 hover:text-pink-900 font-bold transition-colors">
                                <PlusCircleIcon className="h-5 w-5" /> Add Time Range
                            </button>

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                                <p className="text-xs text-blue-800 font-bold">
                                    💡 Note: To clear availability for the day, press the trash icon to remove all rows, then press save.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-end text-sm">
                            <button
                                onClick={handleClearAvailability}
                                disabled={isSaving || selectedDays.length === 0}
                                className="px-6 py-3 w-full sm:w-auto text-center bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all font-bold"
                            >
                                {isSaving ? t('owner.availability.clearing') : t('owner.availability.clearButton')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || selectedDays.length === 0}
                                className="px-6 py-3 w-full sm:w-auto text-center bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-all duration-300 disabled:bg-pink-300 disabled:cursor-not-allowed flex items-center justify-center font-black shadow-lg shadow-pink-200"
                            >
                                {showConfirmation ? <CheckCircleIcon className="h-6 w-6 text-white" /> : (isSaving ? 'Updating...' : 'Save Changes')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
};

export default AvailabilityManager;
