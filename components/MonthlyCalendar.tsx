
import React, { useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';
import { useTranslation } from 'react-i18next';

interface MonthlyCalendarProps {
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    bookings: { date: string }[];
    availability: Record<string, string[]>;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ currentMonth, setCurrentMonth, selectedDate, setSelectedDate, bookings, availability }) => {
    const { i18n } = useTranslation();

    const calendarData = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const dates: (Date | null)[] = Array(startDayOfWeek).fill(null);
        for (let i = 1; i <= daysInMonth; i++) {
            dates.push(new Date(year, month, i));
        }

        // Use i18n.language for localization
        const monthName = firstDay.toLocaleString(i18n.language, { month: 'long' });
        // Capitalize first letter as some locales (like pt-BR) return lowercase
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        return { dates, monthName: capitalizedMonthName, year };
    }, [currentMonth, i18n.language]);

    // Generate localized weekday names (S, M, T...)
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            // Create a date for a specific known Sunday (e.g., Jan 4, 1970 was a Sunday) and add 'i' days
            const date = new Date(1970, 0, 4 + i);
            const dayName = date.toLocaleString(i18n.language, { weekday: 'narrow' });
            days.push(dayName);
        }
        return days;
    }, [i18n.language]);

    const bookingsByDate = useMemo(() => {
        return bookings.reduce((acc: Record<string, number>, b) => {
            acc[b.date] = (acc[b.date] || 0) + 1;
            return acc;
        }, {});
    }, [bookings]);

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-300">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2 rounded-full hover:bg-gray-200">
                    <ChevronLeftIcon className="h-5 w-5 text-black" />
                </button>
                <h3 className="text-lg font-bold text-black">{calendarData.monthName} {calendarData.year}</h3>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2 rounded-full hover:bg-gray-200">
                    <ChevronRightIcon className="h-5 w-5 text-black" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold text-gray-700 mb-2">
                {weekDays.map((day, i) => <div key={i}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {calendarData.dates.map((date, index) => {
                    if (!date) return <div key={`empty-${index}`}></div>;

                    const dateStr = date.toISOString().split('T')[0];
                    const isSelected = selectedDate.toISOString().split('T')[0] === dateStr;
                    const bookingCount = bookingsByDate[dateStr] || 0;
                    const hasAvail = (availability[dateStr] || []).length > 0;
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    // Style Logic: Prioritize Selection > Bookings > Availability > Default
                    let btnClass = 'h-14 w-full rounded-xl transition-all duration-200 text-sm flex flex-col items-center justify-center relative p-1 font-bold border-2 ';

                    if (isSelected) {
                        btnClass += 'bg-pink-600 text-white border-pink-700 shadow-md';
                    } else if (bookingCount > 0) {
                        // Bookings -> Indigo Theme
                        btnClass += 'bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-200';
                    } else if (hasAvail) {
                        // Availability -> Green Theme
                        btnClass += 'bg-green-100 text-green-900 border-green-300 hover:bg-green-200';
                    } else {
                        // Default -> White
                        btnClass += 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50';
                    }

                    if (isToday && !isSelected) {
                        btnClass += ' ring-2 ring-pink-400 ring-offset-1';
                    }

                    return (
                        <button key={dateStr} onClick={() => setSelectedDate(date)} className={btnClass}>
                            <span className="text-lg">{date.getDate()}</span>

                            {/* Small Booking Count Badge */}
                            {bookingCount > 0 && !isSelected && (
                                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white shadow-sm">
                                    {bookingCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthlyCalendar;
