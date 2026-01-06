import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Booking } from '../types';
import Card from './ui/Card';
import { CheckCircleIcon } from './icons/Icons';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (shouldReleaseSlot: boolean) => void;
    booking: Booking | null;
}

const CancellationModal: React.FC<CancellationModalProps> = ({ isOpen, onClose, onConfirm, booking }) => {
    const { t } = useTranslation();
    const [releaseSlot, setReleaseSlot] = useState(true);

    if (!isOpen || !booking) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md">
                <Card>
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black text-gray-800 mb-2">{t('owner.actions.modal.cancelTitle')}</h2>
                        <p className="text-gray-600">
                            {t('owner.actions.cancelConfirm', {
                                name: booking.customerName,
                                date: booking.date,
                                time: booking.time
                            })}
                        </p>
                    </div>

                    {/* Booking Details Summary */}
                    <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                        <p className="text-sm font-bold text-gray-700">{booking.service.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{booking.customerEmail}</p>
                    </div>

                    {/* Release Slot Toggle */}
                    <div className="mb-8 flex items-start gap-3 bg-pink-50 p-4 rounded-xl border border-pink-100">
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id="release-toggle"
                                checked={releaseSlot}
                                onChange={(e) => setReleaseSlot(e.target.checked)}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-6 checked:border-pink-500"
                            />
                            <label
                                htmlFor="release-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${releaseSlot ? 'bg-pink-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                        <div>
                            <label htmlFor="release-toggle" className="block font-bold text-gray-800 text-sm cursor-pointer select-none">
                                {t('owner.actions.modal.releaseLabel')}
                            </label>
                            <p className="text-xs text-gray-600 mt-1 leading-snug">
                                {t('owner.actions.modal.releaseDescription')}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            {t('owner.actions.modal.backBtn')}
                        </button>
                        <button
                            onClick={() => onConfirm(releaseSlot)}
                            className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                        >
                            {t('owner.actions.modal.confirmBtn')}
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CancellationModal;
