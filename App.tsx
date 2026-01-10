import React from 'react';
import Header from './components/Header';
import UserView from './components/UserView';
import OwnerView from './components/OwnerView';
import AuthView from './components/AuthView';
import { useAppContext } from './contexts/AppContext';
import { SpinnerIcon } from './components/icons/Icons';

const App: React.FC = () => {
    const { authStatus, currentUser } = useAppContext();

    const renderContent = () => {
        if (authStatus === 'loading') {
            return (
                <div className="flex justify-center items-center h-screen">
                    <SpinnerIcon className="h-12 w-12 text-pink-600 animate-spin" />
                </div>
            );
        }

        if (authStatus === 'unauthenticated') {
            console.log("App: Rendering AuthView");
            return <AuthView />;
        }

        console.log("App: AuthStatus:", authStatus, "Role:", currentUser?.role);

        if (currentUser?.role === 'owner') {
            console.log("App: Rendering OwnerView");
            try {
                return <OwnerView />;
            } catch (e) {
                console.error("CRASH in OwnerView:", e);
                return <div className="p-10 text-red-600">OwnerView Crashed. Check Console.</div>;
            }
        }

        if (currentUser?.role === 'user') {
            return <UserView />;
        }

        return <div>Something went wrong.</div>;
    };


    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <Header />
            <main className="p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {renderContent()}
                </div>
            </main>
            <footer className="text-center p-4 mt-8 text-gray-600 text-sm">
                <p>&copy; {new Date().getFullYear()} Silky Hair Straightening. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;