
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { CutIcon, EyeIcon, EyeSlashIcon, OwnerIcon, UserIcon, MailIcon } from './icons/Icons';
import Card from './ui/Card';
import { useTranslation } from 'react-i18next';

const AuthView: React.FC = () => {
    const { login, signup, verifyUserEmail, resetPassword } = useAppContext();
    const { t } = useTranslation();
    const [userType, setUserType] = useState<'client' | 'owner'>('client');
    const [isLoginMode, setIsLoginMode] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [isResetMode, setIsResetMode] = useState(false);
    // Verification State
    const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null);

    // Password Visibility State
    const [showPassword, setShowPassword] = useState(false);
    const [showRepeatPassword, setShowRepeatPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isResetMode) {
                await resetPassword(email);
                setIsResetMode(false);
                setIsLoginMode(true);
            } else if (isLoginMode) {
                await login(email, password);
            } else {
                // Validation
                if (password !== repeatPassword) {
                    throw new Error(t('auth.errorMismatch'));
                }
                if (password.length < 6) {
                    throw new Error(t('auth.errorLength'));
                }
                await signup(email, password, name, phoneNumber);
                // Switch to verification mode instead of logging in
                setVerificationSentTo(email);
            }
        } catch (err: any) {
            if (isLoginMode) {
                if (err.code === 'auth/email-not-verified') {
                    setVerificationSentTo(email);
                    return;
                }
                if (
                    err.code === 'auth/invalid-credential' ||
                    err.code === 'auth/wrong-password' ||
                    err.code === 'auth/user-not-found' ||
                    err.code === 'auth/invalid-email'
                ) {
                    setError(t('auth.errorInvalidCreds'));
                } else {
                    setError(t('auth.errorGenericSignIn'));
                }
            } else {
                if (err.code === 'auth/email-already-in-use') {
                    setError(t('auth.errorExists'));
                } else if (err.message === t('auth.errorMismatch') || err.message === "Passwords do not match") {
                    setError(t('auth.errorMismatch'));
                } else {
                    setError(err.message || t('auth.errorGenericSignUp'));
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsLoginMode(!isLoginMode);
        setError(null);
        setPassword('');
        setRepeatPassword('');
        setShowPassword(false);
        setShowRepeatPassword(false);
    };

    const handleSwitchToSignIn = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsLoginMode(true);
        setError(null);
        setPassword('');
        setRepeatPassword('');
        setShowPassword(false);
        setShowRepeatPassword(false);
    };

    const handleUserTypeChange = (type: 'client' | 'owner') => {
        setUserType(type);
        setIsLoginMode(true);
        setError(null);
        setPassword('');
        setRepeatPassword('');
        setName('');
        setEmail('');
        setPhoneNumber('');
        setVerificationSentTo(null);
    };

    if (verificationSentTo) {
        return (
            <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4">
                <div className="text-center mb-8">
                    <CutIcon className="h-16 w-16 text-pink-600 mx-auto" />
                </div>
                <Card className="w-full max-w-md p-8 shadow-xl bg-white border border-gray-300 text-center">
                    <MailIcon className="h-16 w-16 text-pink-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-black mb-2">{t('auth.verifyEmailTitle')}</h2>
                    <p className="text-gray-600 mb-6">
                        {t('auth.verifyEmailDesc')} <span className="font-bold text-black">{verificationSentTo}</span>.
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                        {t('auth.verifyEmailCheck')}
                    </p>

                    <button
                        onClick={() => { setVerificationSentTo(null); setIsLoginMode(true); }}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded transition-colors"
                    >
                        {t('auth.backToSignIn')}
                    </button>
                </Card>
            </div>
        );
    }

    if (isResetMode) {
        return (
            <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4">
                <div className="text-center mb-8">
                    <CutIcon className="h-16 w-16 text-pink-600 mx-auto" />
                </div>
                <Card className="w-full max-w-md p-8 shadow-xl bg-white border border-gray-300 text-center">
                    <h2 className="text-2xl font-bold text-black mb-2">{t('auth.resetPassword')}</h2>
                    <p className="text-gray-600 mb-6">
                        {t('auth.resetPasswordDesc')}
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 text-sm rounded-md text-center font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                            placeholder={t('auth.placeholderEmail')}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded transition-colors"
                        >
                            {loading ? t('auth.sending') : t('auth.sendResetLink')}
                        </button>
                    </form>

                    <button
                        onClick={() => { setIsResetMode(false); setError(null); }}
                        className="mt-6 text-pink-600 hover:text-pink-800 font-bold text-sm"
                    >
                        {t('auth.backToLogin')}
                    </button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4">
            <div className="text-center mb-8">
                <CutIcon className="h-16 w-16 text-pink-600 mx-auto" />
                <h1 className="text-4xl font-extrabold text-black tracking-tight mt-4">
                    {t('common.welcome')}
                </h1>
            </div>

            <Card className="w-full max-w-md shadow-xl overflow-hidden bg-white border border-gray-300">
                {/* Role Tabs */}
                <div className="flex border-b border-gray-300">
                    <button
                        onClick={() => handleUserTypeChange('client')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${userType === 'client' ? 'bg-white text-pink-700 border-b-4 border-pink-600' : 'bg-gray-100 text-gray-600 hover:text-gray-900'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <UserIcon className="h-5 w-5" />
                            {t('auth.clientAccess')}
                        </div>
                    </button>
                    <button
                        onClick={() => handleUserTypeChange('owner')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${userType === 'owner' ? 'bg-white text-purple-700 border-b-4 border-purple-600' : 'bg-gray-100 text-gray-600 hover:text-gray-900'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <OwnerIcon className="h-5 w-5" />
                            {t('auth.ownerAccess')}
                        </div>
                    </button>
                </div>

                <div className="p-8">
                    <h2 className="text-2xl font-bold text-black mb-6 text-center">
                        {userType === 'owner'
                            ? t('auth.ownerLogin')
                            : (isLoginMode ? t('auth.clientSignIn') : t('auth.createAccount'))
                        }
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 text-sm rounded-md text-center font-medium">
                            {error}
                            {error === t('auth.errorExists') && (
                                <button onClick={handleSwitchToSignIn} className="ml-2 underline font-bold hover:text-red-900">
                                    {t('auth.signIn')}
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLoginMode && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="name">{t('auth.fullName')}</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                    placeholder={userType === 'owner' ? t('auth.placeholderNameOwner') : t('auth.placeholderName')}
                                    autoComplete="name"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="email">{t('auth.email')}</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                placeholder={userType === 'owner' ? t('auth.placeholderEmailOwner') : t('auth.placeholderEmail')}
                                autoComplete="username email"
                            />
                        </div>

                        {!isLoginMode && userType === 'client' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="phoneNumber">{t('auth.phoneNumber')}</label>
                                <input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                    placeholder={t('auth.placeholderPhone')}
                                    autoComplete="tel"
                                />
                            </div>
                        )}

                        {!isResetMode && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-bold text-gray-800" htmlFor="password">{t('auth.password')}</label>
                                    {isLoginMode && (
                                        <button
                                            type="button"
                                            onClick={() => { setIsResetMode(true); setError(null); }}
                                            className="text-xs text-pink-600 hover:text-pink-800 font-bold"
                                        >
                                            {t('auth.forgotPassword')}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full p-3 pr-10 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                        placeholder="••••••••"
                                        autoComplete={isLoginMode ? "current-password" : "new-password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-pink-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!isLoginMode && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="repeatPassword">{t('auth.repeatPassword')}</label>
                                <div className="relative">
                                    <input
                                        id="repeatPassword"
                                        name="confirmPassword"
                                        type={showRepeatPassword ? "text" : "password"}
                                        required
                                        value={repeatPassword}
                                        onChange={(e) => setRepeatPassword(e.target.value)}
                                        className="w-full p-3 pr-10 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-pink-600 focus:outline-none"
                                    >
                                        {showRepeatPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-6 ${userType === 'owner' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-pink-600 hover:bg-pink-700'}`}
                        >
                            {loading ? t('auth.processing') : (isLoginMode ? t('auth.signIn') : t('auth.signUp'))}
                        </button>
                    </form>

                    <div className="mt-6 text-center border-t border-gray-200 pt-4">
                        {userType === 'client' && (
                            <p className="text-sm text-gray-700">
                                {isLoginMode ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}
                                <button
                                    onClick={switchMode}
                                    className="ml-2 font-bold hover:underline focus:outline-none text-pink-700"
                                >
                                    {isLoginMode ? t('auth.register') : t('auth.signIn')}
                                </button>
                            </p>
                        )}
                        {userType === 'owner' && (
                            <p className="text-sm text-gray-500 italic">
                                {t('auth.ownerManualAuth')}
                                <br />
                                <button
                                    onClick={() => { setIsResetMode(true); setError(null); }}
                                    className="text-xs text-purple-700 hover:text-purple-900 font-bold mt-2"
                                >
                                    {t('auth.forgotOwnerPassword')}
                                </button>
                            </p>
                        )}
                    </div>
                </div>

                {/* Helper for Credentials */}

            </Card>
        </div>
    );
};

export default AuthView;

