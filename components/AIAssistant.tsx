import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppContext } from '../contexts/AppContext';
import { MicrophoneIcon, SparklesIcon, CheckCircleIcon, TrashIcon } from './icons/Icons';
import Card from './ui/Card';
import { useTranslation } from 'react-i18next';
import { getLocalDateString } from '../utils/dateUtils';

// Embedded API Key for seamless owner experience
const API_KEY = "AIzaSyAok6yETYZmrXz6UisXlwRoUVc2n-iHs7Q";

const AIAssistant: React.FC = () => {
    const { t, i18n } = useTranslation();
    const {
        overwriteAvailabilityForDates,
        clearAvailabilityForDates,
        bookings,
        bookingRequests,
        cancelBooking,
        confirmBookingRequest
    } = useAppContext();

    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [parsedAction, setParsedAction] = useState<any | null>(null);
    const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // API Key is now managed internally
    const apiKey = API_KEY;

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            // set language based on current app locale, default to Portuguese (Brazil) if matches, or English
            recognitionRef.current.lang = i18n.language === 'pt' ? 'pt-BR' : i18n.language;

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, [i18n.language]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setResultMessage(null);
            setParsedAction(null);
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setProcessing(true);
        setResultMessage(null);
        setParsedAction(null);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const currentDate = getLocalDateString(new Date());

            const prompt = `
                You are an AI assistant for a hair salon owner.
                Current Date: ${currentDate}
                
                Your task is to parse the user's natural language command into a structured JSON object.
                The user may speak in English, Portuguese (pt-BR), or Spanish. You must understand all of them.

                Valid actions are: "clear_availability", "set_availability", "cancel_booking", "confirm_request", "send_message".
                
                For "clear_availability" (also "remove", "delete", "cancel availability", "limpar agenda", "remover disponibilidade"):
                - Extract dates. Return dates in YYYY-MM-DD format.
                - JSON: { "action": "clear_availability", "dates": ["2024-01-01"] }
                
                For "set_availability" (also "create", "add", "open", "marcar", "abrir agenda", "definir horario"):
                - Extract dates (YYYY-MM-DD).
                - Extract time ranges (start and end times, e.g., "09:00 AM").
                - JSON: { "action": "set_availability", "dates": ["2024-01-01"], "ranges": [{ "start": "09:00 AM", "end": "05:00 PM" }] }
                
                For "cancel_booking" (also "cancelar agendamento"):
                - Extract customer name or date. 
                - JSON: { "action": "cancel_booking", "query": "John Doe" }
                
                For "confirm_request" (also "confirmar", "aprovar"):
                - Extract customer name or date.
                - JSON: { "action": "confirm_request", "query": "Jane Smith" }
                
                For "send_message" (also "enviar mensagem"):
                - Extract recipient (query), subject, and body.
                - JSON: { "action": "send_message", "query": "John", "subject": "Hi", "body": "..." }

                If unknown, return { "action": "unknown" }.
                
                User Command: "${input}"
                
                Return ONLY the JSON object. Do not include markdown formatting.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(cleanedText);
            console.log("Parsed AI Action:", json);

            setParsedAction(json);
        } catch (error: any) {
            console.error(error);
            const errorMsg = error.message || t('owner.ai.error');
            setResultMessage({ type: 'error', text: `${t('owner.ai.error')} (${errorMsg})` });
        } finally {
            setProcessing(false);
        }
    };

    const handleExecute = async () => {
        if (!parsedAction) return;
        setProcessing(true);

        try {
            switch (parsedAction.action) {
                case 'clear_availability':
                    if (parsedAction.dates && Array.isArray(parsedAction.dates)) {
                        await clearAvailabilityForDates(parsedAction.dates);
                        setResultMessage({ type: 'success', text: `${t('owner.ai.success')} (Cleared: ${parsedAction.dates.join(', ')})` });
                    }
                    break;
                case 'set_availability':
                    if (parsedAction.dates && parsedAction.ranges) {
                        await overwriteAvailabilityForDates(parsedAction.dates, parsedAction.ranges);
                        setResultMessage({ type: 'success', text: `${t('owner.ai.success')} (Set: ${parsedAction.dates.join(', ')})` });
                    }
                    break;
                case 'cancel_booking':
                    if (parsedAction.query) {
                        const queryLower = parsedAction.query.toLowerCase();
                        const matches = bookings.filter(b => b.customerName.toLowerCase().includes(queryLower));

                        if (matches.length === 1) {
                            await cancelBooking(matches[0].id);
                            setResultMessage({ type: 'success', text: `Cancelled booking for ${matches[0].customerName} on ${matches[0].date}.` });
                        } else if (matches.length === 0) {
                            setResultMessage({ type: 'error', text: `No bookings found for "${parsedAction.query}".` });
                        } else {
                            setResultMessage({ type: 'error', text: `Multiple bookings found for "${parsedAction.query}". Please be more specific.` });
                        }
                    }
                    break;
                case 'confirm_request':
                    if (parsedAction.query) {
                        const queryLower = parsedAction.query.toLowerCase();
                        const matches = bookingRequests.filter(r => r.customerName.toLowerCase().includes(queryLower));

                        if (matches.length === 1) {
                            await confirmBookingRequest(matches[0].id);
                            setResultMessage({ type: 'success', text: `Confirmed request for ${matches[0].customerName} on ${matches[0].date}.` });
                        } else if (matches.length === 0) {
                            setResultMessage({ type: 'error', text: `No requests found for "${parsedAction.query}".` });
                        } else {
                            setResultMessage({ type: 'error', text: `Multiple requests found for "${parsedAction.query}". Please be more specific.` });
                        }
                    }
                    break;
                case 'send_message':
                    setResultMessage({ type: 'success', text: "Message simulated (Functionality pending full email integration)." });
                    break;
                case 'unknown':
                    setResultMessage({ type: 'error', text: "Could not understand command." });
                    break;
                default:
                    setResultMessage({ type: 'success', text: `Action ${parsedAction.action} executed (Simulation).` });
            }
        } catch (e) {
            setResultMessage({ type: 'error', text: t('owner.ai.error') });
        } finally {
            setProcessing(false);
            setParsedAction(null);
        }
    };

    const renderActionSummary = (action: any) => {
        if (!action) return null;

        switch (action.action) {
            case 'clear_availability':
                return (
                    <div>
                        <p className="font-bold text-lg text-indigo-900">Clear Availability</p>
                        <p className="text-gray-700">Dates: <span className="font-mono text-indigo-700 font-bold">{action.dates?.join(', ')}</span></p>
                    </div>
                );
            case 'set_availability':
                return (
                    <div>
                        <p className="font-bold text-lg text-indigo-900">Set Availability</p>
                        <p className="text-gray-700">Dates: <span className="font-mono text-indigo-700 font-bold">{action.dates?.join(', ')}</span></p>
                        <p className="text-gray-700">Time: <span className="font-bold">{action.ranges?.map((r: any) => `${r.start} - ${r.end}`).join(', ')}</span></p>
                    </div>
                );
            case 'cancel_booking':
                return (
                    <div>
                        <p className="font-bold text-lg text-indigo-900">Cancel Booking</p>
                        <p className="text-gray-700">Search Query: <span className="font-bold italic">"{action.query}"</span></p>
                    </div>
                );
            case 'confirm_request':
                return (
                    <div>
                        <p className="font-bold text-lg text-indigo-900">Confirm Request</p>
                        <p className="text-gray-700">Search Query: <span className="font-bold italic">"{action.query}"</span></p>
                    </div>
                );
            case 'send_message':
                return (
                    <div>
                        <p className="font-bold text-lg text-indigo-900">Send Message</p>
                        <p className="text-gray-700">To: <span className="font-bold">{action.query}</span></p>
                        <p className="text-gray-700">Subject: <span className="italic">{action.subject}</span></p>
                    </div>
                );
            default:
                return <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(action, null, 2)}</pre>;
        }
    };

    return (
        <Card className="max-w-2xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <SparklesIcon className="h-8 w-8 text-indigo-500" />
                    <h2 className="text-2xl font-black text-gray-900">{t('owner.ai.title')}</h2>
                </div>
            </div>

            <div className="relative mb-4">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('owner.ai.placeholder')}
                    className="w-full p-4 pr-16 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-0 outline-none resize-none h-32 text-lg"
                />
                <button
                    onClick={toggleListening}
                    className={`absolute bottom-4 right-4 p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600'}`}
                    title={isListening ? t('owner.ai.stopListening') : t('owner.ai.startListening')}
                >
                    <MicrophoneIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="flex justify-end mb-6">
                <button
                    onClick={handleAnalyze}
                    disabled={processing || !input.trim()}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {processing ? (
                        <>
                            <SparklesIcon className="h-5 w-5 animate-spin" />
                            {t('owner.ai.processing')}
                        </>
                    ) : (
                        <>
                            <SparklesIcon className="h-5 w-5" />
                            Analyze Command
                        </>
                    )}
                </button>
            </div>

            {parsedAction && (
                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-xl p-6 mb-6 animate-fade-in">
                    <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" />
                        {t('owner.ai.confirmTitle')}
                    </h3>
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 mb-4 font-medium text-indigo-900">
                        {renderActionSummary(parsedAction)}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setParsedAction(null)}
                            className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50"
                        >
                            {t('owner.ai.cancel')}
                        </button>
                        <button
                            onClick={handleExecute}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md"
                        >
                            {t('owner.ai.execute')}
                        </button>
                    </div>
                </div>
            )}

            {resultMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${resultMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {resultMessage.type === 'success' ? <CheckCircleIcon className="h-6 w-6" /> : <TrashIcon className="h-6 w-6" />}
                    <span className="font-bold">{resultMessage.text}</span>
                </div>
            )}
        </Card>
    );
};

export default AIAssistant;
