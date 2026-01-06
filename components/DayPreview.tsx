import React from 'react';
import { Booking } from '../types';
import { ClockIcon, CutIcon, UserIcon, PencilIcon, TrashIcon, ChatBubbleIcon } from './icons/Icons';
import Card from './ui/Card';
import { useTranslation } from 'react-i18next';
import { timeToMinutes, minutesToTime, calculateEndTime } from '../utils/timeUtils';

interface DayPreviewProps {
    date: Date;
    bookings: Booking[];
    availability: string[];
    onEditBooking: (booking: Booking) => void;
    onCancelBooking: (bookingId: string) => void;
}

const DayPreview: React.FC<DayPreviewProps> = ({ date, bookings, availability, onEditBooking, onCancelBooking }) => {
    const { t, i18n } = useTranslation();

    const availabilityRanges = React.useMemo(() => {
        if (!availability || availability.length === 0) return [];
        const slotsInMinutes = availability.map(timeToMinutes).sort((a, b) => a - b);
        if (slotsInMinutes.some(isNaN)) return [];
        const ranges: string[] = [];
        let rangeStart = slotsInMinutes[0];
        for (let i = 1; i < slotsInMinutes.length; i++) {
            if (slotsInMinutes[i] > slotsInMinutes[i - 1] + 60) {
                ranges.push(`${minutesToTime(rangeStart)} - ${minutesToTime(slotsInMinutes[i - 1] + 60)}`);
                rangeStart = slotsInMinutes[i];
            }
        }
        ranges.push(`${minutesToTime(rangeStart)} - ${minutesToTime(slotsInMinutes[slotsInMinutes.length - 1] + 60)}`);
        return ranges;
    }, [availability]);

    // Capitalize localized date
    const dateStr = date.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });
    const capitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    const sortedBookings = React.useMemo(() => {
        return [...bookings].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    }, [bookings]);

    return (
        <Card className="p-4 sm:p-6 h-full flex flex-col">
            <h3 className="text-xl font-black text-gray-900 mb-6 border-b border-gray-100 pb-4 first-letter:capitalize">
                {capitalizedDateStr}
            </h3>
            <div className="space-y-6 flex-1 overflow-y-auto">
                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('owner.schedule.appointments')}</h4>
                    {sortedBookings.length > 0 ? (
                        <ul className="space-y-4">
                            {sortedBookings.map(b => (
                                <li key={b.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-pink-200 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center text-sm font-black text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
                                            <ClockIcon className="h-3 w-3 mr-1.5" />
                                            {b.time} - {calculateEndTime(b.time, b.service.duration)}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onEditBooking(b)}
                                                className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
                                                title="Edit Appointment Notes"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => onCancelBooking(b.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Cancel Appointment"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center text-sm font-bold text-gray-900">
                                            <UserIcon className="h-4 w-4 mr-2 text-gray-400" /> {b.customerName}
                                        </div>
                                        <div className="flex items-center text-xs text-gray-500 font-medium">
                                            <CutIcon className="h-4 w-4 mr-2 text-gray-400" /> {b.service.name}
                                        </div>
                                    </div>
                                    {b.customerNotes && (
                                        <div className="mt-3 text-[11px] text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 italic">
                                            <span className="font-black text-[9px] uppercase block mb-1 text-gray-400">Client Note:</span>
                                            "{b.customerNotes}"
                                        </div>
                                    )}
                                    {b.ownerNotes && (
                                        <div className="mt-2 text-[11px] text-yellow-800 bg-yellow-50 p-3 rounded-xl border border-yellow-200 font-medium">
                                            <span className="font-black text-[9px] uppercase block mb-1 text-yellow-600">Private Owner Note:</span>
                                            {b.ownerNotes}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400 font-bold">{t('owner.schedule.noAppointments', 'No appointments for this day')}</p>
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('owner.schedule.preSetAvailability', 'Pre-set Availability')}</h4>
                    {availabilityRanges.length > 0 ? (
                        <ul className="space-y-2">
                            {availabilityRanges.map((range, i) => (
                                <li key={i} className="text-xs p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 font-black text-center">{range}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-[10px] text-gray-400 font-bold italic">{t('owner.schedule.noSpecificHours', 'No specific hours defined')}</p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default DayPreview;