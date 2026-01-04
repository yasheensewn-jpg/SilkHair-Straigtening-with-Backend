import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { CutIcon, LogoutIcon, ChevronDownIcon } from './icons/Icons';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

const Header: React.FC = () => {
    const { currentUser, logout } = useAppContext();
    const { i18n } = useTranslation();
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsLangMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        setIsLangMenuOpen(false);
    };

    const getLanguageLabel = (lang: string) => {
        switch (lang) {
            case 'pt-BR': return { flag: '🇧🇷', name: 'PT' };
            case 'es': return { flag: '🇪🇸', name: 'ES' };
            default: return { flag: '🇺🇸', name: 'EN' };
        }
    };

    const currentLang = getLanguageLabel(i18n.language);

    return (
        <header className="bg-white shadow-md relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <CutIcon className="h-8 w-8 text-pink-500" />
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Silky Hair Straightening
                    </h1>
                </div>
                <div className="flex items-center space-x-4">

                    {/* Language Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-slate-700"
                        >
                            <span className="text-base">{currentLang.flag}</span>
                            <span>{currentLang.name}</span>
                            <ChevronDownIcon className={`h-3 w-3 ml-1 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isLangMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1">
                                <button onClick={() => changeLanguage('en')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2">
                                    <span className="text-lg">🇺🇸</span> <span className="text-gray-700 font-medium">English</span>
                                </button>
                                <button onClick={() => changeLanguage('pt-BR')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2">
                                    <span className="text-lg">🇧🇷</span> <span className="text-gray-700 font-medium">Português</span>
                                </button>
                                <button onClick={() => changeLanguage('es')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2">
                                    <span className="text-lg">🇪🇸</span> <span className="text-gray-700 font-medium">Español</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {currentUser && (
                        <>
                            <span className="text-sm font-medium text-slate-700 hidden sm:block">
                                Welcome, <span className="font-bold">{currentUser.name.split(' ')[0]}</span>
                            </span>
                            <button
                                onClick={logout}
                                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-600"
                                aria-label="Logout"
                            >
                                <LogoutIcon className="h-4 w-4" />
                                <span className="hidden sm:block">Logout</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;