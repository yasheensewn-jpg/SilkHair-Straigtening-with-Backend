
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { CutIcon, EyeIcon, EyeSlashIcon, OwnerIcon, UserIcon, MailIcon } from './icons/Icons';
import Card from './ui/Card';

const AuthView: React.FC = () => {
    const { login, signup, verifyUserEmail, resetPassword } = useAppContext();
    const [userType, setUserType] = useState<'client' | 'owner'>('client');
    const [isLoginMode, setIsLoginMode] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
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
                    throw new Error("Passwords do not match");
                }
                if (password.length < 6) {
                    throw new Error("Password must be at least 6 characters");
                }
                await signup(email, password, name);
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
                    setError("Password or Email Incorrect");
                } else {
                    setError("Failed to sign in. Please check your credentials.");
                }
            } else {
                if (err.code === 'auth/email-already-in-use') {
                    setError("User already exists. Sign in?");
                } else if (err.message === "Passwords do not match") {
                    setError("Passwords do not match");
                } else {
                    setError(err.message || "Failed to sign up");
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
                    <h2 className="text-2xl font-bold text-black mb-2">Verify your Email</h2>
                    <p className="text-gray-600 mb-6">
                        We have sent a verification email to <span className="font-bold text-black">{verificationSentTo}</span>.
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                        Please check your inbox and click the link to verify your account before logging in.
                    </p>

                    <button
                        onClick={() => { setVerificationSentTo(null); setIsLoginMode(true); }}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded transition-colors"
                    >
                        Back to Sign In
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
                    <h2 className="text-2xl font-bold text-black mb-2">Reset Password</h2>
                    <p className="text-gray-600 mb-6">
                        Enter your email to receive a password reset link.
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
                            placeholder="you@example.com"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded transition-colors"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <button
                        onClick={() => { setIsResetMode(false); setError(null); }}
                        className="mt-6 text-pink-600 hover:text-pink-800 font-bold text-sm"
                    >
                        Back to Login
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
                    Silky Hair Straightening
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
                            Client Access
                        </div>
                    </button>
                    <button
                        onClick={() => handleUserTypeChange('owner')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${userType === 'owner' ? 'bg-white text-purple-700 border-b-4 border-purple-600' : 'bg-gray-100 text-gray-600 hover:text-gray-900'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <OwnerIcon className="h-5 w-5" />
                            Owner Access
                        </div>
                    </button>
                </div>

                <div className="p-8">
                    <h2 className="text-2xl font-bold text-black mb-6 text-center">
                        {userType === 'owner'
                            ? 'Owner Login'
                            : (isLoginMode ? 'Client Sign In' : 'Create Account')
                        }
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 text-sm rounded-md text-center font-medium">
                            {error}
                            {error === "User already exists. Sign in?" && (
                                <button onClick={handleSwitchToSignIn} className="ml-2 underline font-bold hover:text-red-900">
                                    Sign in
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLoginMode && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="name">Full Name</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                    placeholder={userType === 'owner' ? "Laura Assuncao" : "Your Name"}
                                    autoComplete="name"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 border border-gray-400 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-black bg-white placeholder-gray-500"
                                placeholder={userType === 'owner' ? "laura@silkyhair.com" : "you@example.com"}
                                autoComplete="username email"
                            />
                        </div>

                        {!isResetMode && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-bold text-gray-800" htmlFor="password">Password</label>
                                    {isLoginMode && (
                                        <button
                                            type="button"
                                            onClick={() => { setIsResetMode(true); setError(null); }}
                                            className="text-xs text-pink-600 hover:text-pink-800 font-bold"
                                        >
                                            Forgot Password?
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
                                <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="repeatPassword">Repeat Password</label>
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
                            {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="mt-6 text-center border-t border-gray-200 pt-4">
                        {userType === 'client' && (
                            <p className="text-sm text-gray-700">
                                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                                <button
                                    onClick={switchMode}
                                    className="ml-2 font-bold hover:underline focus:outline-none text-pink-700"
                                >
                                    {isLoginMode ? 'Register' : 'Sign In'}
                                </button>
                            </p>
                        )}
                        {userType === 'owner' && (
                            <p className="text-sm text-gray-500 italic">
                                Note: Owner accounts must be manually authorized.
                                <br />
                                <button
                                    onClick={() => { setIsResetMode(true); setError(null); }}
                                    className="text-xs text-purple-700 hover:text-purple-900 font-bold mt-2"
                                >
                                    Forgot Owner Password?
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
