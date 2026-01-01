import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { CutIcon, LogoutIcon } from './icons/Icons';

const Header: React.FC = () => {
    const { currentUser, logout } = useAppContext();

    return (
        <header className="bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <CutIcon className="h-8 w-8 text-pink-500" />
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Silky Hair Straightening
                    </h1>
                </div>
                {currentUser && (
                    <div className="flex items-center space-x-4">
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
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;