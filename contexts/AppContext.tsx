import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { Booking, Service, Client, User, Owner, Message } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { auth, db } from '../firebaseConfig';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    sendEmailVerification
} from 'firebase/auth';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    deleteDoc,
    getDocs
} from 'firebase/firestore';

// --- CONSTANTS ---
// (Owner constants removed - dynamic RBAC used)
const DEFAULT_SERVICES = [
    { id: '1', name: 'Hair Straightening Treatment', duration: 240, price: 250, description: 'Our signature treatment for smooth, silky, and straight hair.' }
];

const TEST_CLIENT: Client = {
    id: 'client-test-1',
    name: 'Test Client',
    email: 'test@test',
    password: 'test1234',
    role: 'user',
    bookings: [],
    lastSeen: new Date().toISOString(),
    dob: '1990-01-01',
    emailVerified: true
};

// --- AUTH TYPES ---
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AppContextType {
    authStatus: AuthStatus;
    currentUser: User | null;
    login: (email: string, pass: string) => Promise<void>;
    signup: (email: string, pass: string, name: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => void;
    resetPassword: (email: string) => void;
    updateUserProfile: (name: string, photo: string) => Promise<void>;
    deleteUserAccount: () => Promise<void>;
    verifyUserEmail: (email: string) => Promise<void>;
    services: Service[];
    bookings: Booking[];
    bookingRequests: Booking[];
    availability: Record<string, string[]>;
    clients: Client[];
    messages: Message[];
    addBookingRequest: (request: Omit<Booking, 'id'>) => Promise<void>;
    confirmBookingRequest: (requestId: string) => Promise<void>;
    declineBookingRequest: (requestId: string) => Promise<void>;
    cancelBooking: (bookingId: string) => Promise<void>;
    updateBooking: (bookingId: string, updatedDetails: Partial<Omit<Booking, 'id'>>) => Promise<void>;
    addManualBooking: (bookingDetails: Omit<Booking, 'id'>) => Promise<void>;
    getCalculatedAvailableSlots: (date: string, service: Service) => string[];
    ownerDefinedTimeSlots: string[];
    overwriteAvailabilityForDates: (dates: string[], timeRanges: { start: string; end: string }[]) => Promise<void>;
    updateAvailabilitySlots: (date: string, slots: string[]) => Promise<void>;
    clearAvailabilityForDates: (dates: string[]) => Promise<void>;
    sendMessage: (recipientId: string, subject: string, body: string, threadId?: string) => Promise<void>;
    markMessageAsRead: (messageId: string) => Promise<void>;
    markThreadAsRead: (threadId: string) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    updateClientNotes: (clientId: string, notes: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const timeToMinutes = (timeStr: string): number => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = modifier === 'AM' ? 0 : 12;
    else if (modifier === 'PM') hours += 12;
    return hours * 60 + (minutes || 0);
};

const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const paddedMinutes = m < 10 ? `0${m}` : String(m);
    return `${hour12}:${paddedMinutes} ${ampm}`;
};

const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let i = 0; i < 24; i++) {
        const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
        const modifier = i < 12 || i === 24 ? 'AM' : 'PM';
        slots.push(`${hour}:00 ${modifier}`);
    }
    return slots;
};



export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [services] = useState<Service[]>(DEFAULT_SERVICES);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingRequests, setBookingRequests] = useState<Booking[]>([]);
    const [availability, setAvailability] = useState<Record<string, string[]>>({});
    const [clients, setClients] = useState<Client[]>([TEST_CLIENT]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Enforce Email Verification
                if (!user.emailVerified) {
                    // Only allow access if verified
                    // We might need to allow them to stay "logged in" sufficiently to click "resend",
                    // but the requirement is "verify... before proceeding".
                    // The cleanest way is to signOut them if they land here unverified,
                    // UNLESS we want to support a "Check Email" state while authenticated.
                    // Given the request: "initial registration should present a way to verify... before proceeding to sign in",
                    // we will treat unverified as unauthenticated for the app's protected views.
                    setAuthStatus('unauthenticated');
                    return;
                }

                // User is signed in AND verified. Fetch data from Firestore to get Role
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data(); // Treat as untyped data first
                    const role = userData.role || 'user';

                    let appUser: User;
                    if (role === 'owner') {
                        appUser = { ...userData, id: user.uid, role: 'owner' } as Owner;
                    } else {
                        appUser = {
                            ...userData,
                            id: user.uid,
                            role: 'user',
                            emailVerified: user.emailVerified
                        } as Client;
                    }
                    setCurrentUser(appUser);
                    setAuthStatus('authenticated');
                } else {
                    // Might be a new Google user who doesn't have a doc yet
                    console.warn("User authenticated but no doc found");
                    setAuthStatus('unauthenticated');
                }
            } else {
                // User is signed out
                setCurrentUser(null);
                setAuthStatus('unauthenticated');
            }
        });

        return () => unsubscribe();
    }, []);

    // Set up real-time listeners for data (Bookings, etc.)
    useEffect(() => {
        // Only run listeners if authenticated and verified
        // (currentUser check handles this implicitly but good to be safe)
        if (!currentUser) return;

        // Listen to bookings
        const bookingsUnsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
            setBookings(bookingsData);
        });

        // Listen to booking requests
        const requestsUnsub = onSnapshot(collection(db, 'bookingRequests'), (snapshot) => {
            const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
            setBookingRequests(requestsData);
        });

        // Listen to availability
        const availUnsub = onSnapshot(collection(db, 'availability'), (snapshot) => {
            const availData: Record<string, string[]> = {};
            snapshot.docs.forEach(doc => {
                availData[doc.id] = doc.data().slots;
            });
            setAvailability(availData);
        });

        // Listen to messages
        // Filter by current user? Or fetch all involving current user?
        // Firestore rules should handle security, but for now client side filter or query:
        // Ideally: collection(db, 'messages'), where('participants', 'array-contains', currentUser.id)
        // But our schema is senderId/recipientId. We need OR query or two listeners.
        // OR just listen to all messages and filter in UI (bad for scale, good for MVP/prototype).
        // Given the existing app loaded all messages from localStorage:
        const messagesUnsub = onSnapshot(collection(db, 'messages'), (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });

        let clientsUnsub = () => { };
        // Only listen to clients if owner
        if (currentUser?.role === 'owner') {
            clientsUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
                const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(clientsData);
            });
        }

        return () => {
            bookingsUnsub();
            requestsUnsub();
            availUnsub();
            messagesUnsub();
            clientsUnsub();
        };
    }, [currentUser?.role, currentUser?.id]); // Added ID to dependency to ensure re-run on login

    const login = async (email: string, pass: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            throw { code: 'auth/email-not-verified', message: 'Please verify your email address.' };
        }
    };

    const signup = async (email: string, pass: string, name: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        const newClient: Client = {
            id: user.uid, name, email, password: '', role: 'user', lastSeen: new Date().toISOString(),
            bookings: [], dob: '', emailVerified: false
        };
        await setDoc(doc(db, 'users', user.uid), newClient);
        await sendEmailVerification(user);
        await signOut(auth); // Force them to login again after verifying
    };

    const verifyUserEmail = async (email: string) => {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            const newClient: Client = {
                id: user.uid, name: user.displayName || 'Google User', email: user.email || '',
                password: '', role: 'user', lastSeen: new Date().toISOString(),
                bookings: [], dob: '', emailVerified: user.emailVerified, photo: user.photoURL || undefined
            };
            await setDoc(userDocRef, newClient);
        }
    };

    const logout = useCallback(async () => {
        await signOut(auth);
        setCurrentUser(null);
        setAuthStatus('unauthenticated');
    }, []);

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
        alert(`Password reset link sent to ${email}`);
    };

    const updateUserProfile = async (name: string, photo: string) => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, { name, photo });
        setCurrentUser(prev => prev ? { ...prev, name, photo } : null);
    };

    const deleteUserAccount = async () => {
        if (!currentUser) return;
        // Ideally use Cloud Functions for cleanup, but client-side delete for now:
        if (currentUser.role === 'user') {
            await deleteDoc(doc(db, 'users', currentUser.id));
        }
        if (auth.currentUser) await auth.currentUser.delete();
    };

    const addBookingRequest = async (requestDetails: Omit<Booking, 'id'>) => {
        // Check for conflicts with existing confirmed bookings
        const bookingsRef = collection(db, 'bookings');
        const q = query(bookingsRef, where('date', '==', requestDetails.date), where('time', '==', requestDetails.time));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            throw new Error("This time slot is no longer available.");
        }

        const id = uuidv4();
        const newReq = { ...requestDetails, id };
        // We can store the ID in the doc or just use the doc ID. 
        // The snapshot listener maps doc.id to 'id', so storing it is optional but harmless.
        await setDoc(doc(db, 'bookingRequests', id), newReq);
    };

    const confirmBookingRequest = async (requestId: string) => {
        // Move from requests to bookings
        const reqRef = doc(db, 'bookingRequests', requestId);
        const reqSnap = await getDoc(reqRef);
        if (reqSnap.exists()) {
            const data = reqSnap.data() as Booking;
            // Add to bookings
            await setDoc(doc(db, 'bookings', requestId), data); // Use same ID
            // Remove from requests
            await deleteDoc(reqRef);
        }
    };

    const addManualBooking = async (bookingDetails: Omit<Booking, 'id'>) => {
        const id = uuidv4();
        const newBooking = { ...bookingDetails, id };
        await setDoc(doc(db, 'bookings', id), newBooking);
    };

    const declineBookingRequest = async (requestId: string) => {
        await deleteDoc(doc(db, 'bookingRequests', requestId));
    };

    const cancelBooking = async (bookingId: string) => {
        await deleteDoc(doc(db, 'bookings', bookingId));
    };

    const updateBooking = async (bookingId: string, updatedDetails: Partial<Omit<Booking, 'id'>>) => {
        await updateDoc(doc(db, 'bookings', bookingId), updatedDetails);
    };

    const overwriteAvailabilityForDates = async (dates: string[], timeRanges: { start: string; end: string }[]) => {
        const slots = timeRanges.flatMap(range => {
            const start = timeToMinutes(range.start), end = timeToMinutes(range.end);
            if (isNaN(start) || isNaN(end) || start >= end) return [];
            const rangeSlots = [];
            for (let mins = start; mins < end; mins += 60) rangeSlots.push(minutesToTime(mins));
            return rangeSlots;
        });

        await Promise.all(dates.map(date =>
            setDoc(doc(db, 'availability', date), { slots })
        ));
    };

    const clearAvailabilityForDates = async (dates: string[]) => {
        try {
            await Promise.all(dates.map(date =>
                deleteDoc(doc(db, 'availability', date))
            ));
        } catch (error) {
            console.error("clearAvailabilityForDates failed:", error);
        }
    };

    const updateAvailabilitySlots = async (date: string, slots: string[]) => {
        await setDoc(doc(db, 'availability', date), { slots });
    };

    const sendMessage = async (recipientId: string, subject: string, body: string, threadId?: string) => {
        if (!currentUser) return;
        const resolvedThreadId = threadId || [currentUser.id, recipientId].sort().join('_');
        const id = uuidv4();
        const newMessage: Message = {
            id,
            senderId: currentUser.id,
            senderName: currentUser.name,
            recipientId,
            subject,
            body,
            timestamp: new Date().toISOString(),
            read: false,
            threadId: resolvedThreadId
        };
        await setDoc(doc(db, 'messages', id), newMessage);
    };

    const markMessageAsRead = async (messageId: string) => {
        await updateDoc(doc(db, 'messages', messageId), { read: true });
    };

    const markThreadAsRead = async (threadId: string) => {
        if (!currentUser) return;
        // Query for unread messages in this thread for this user
        // Note: Using client-side filter for simplicity since we have all messages synced.

        const unreadMessages = messages.filter(m =>
            m.threadId === threadId &&
            m.recipientId === currentUser.id &&
            !m.read
        );

        unreadMessages.forEach(async (msg) => {
            await updateDoc(doc(db, 'messages', msg.id), { read: true });
        });
    };

    const deleteClient = async (clientId: string) => {
        await deleteDoc(doc(db, 'users', clientId));
    };

    const updateClientNotes = async (clientId: string, notes: string) => {
        await updateDoc(doc(db, 'users', clientId), { ownerNotes: notes });
    };

    const getCalculatedAvailableSlots = useCallback((date: string, service: Service): string[] => {
        const ownerSlotsForDate = availability[date] || [];
        if (ownerSlotsForDate.length === 0) return [];

        // 1. Parse all available start times (minutes)
        const availabilityInMinutes = ownerSlotsForDate.map(timeToMinutes).sort((a, b) => a - b);

        // 2. Determine Session boundaries
        const dayStartTime = availabilityInMinutes[0];
        // Implicitly 1 hour after the last available slot start time
        const dayEndTime = availabilityInMinutes[availabilityInMinutes.length - 1] + 60;

        const SERVICE_DURATION = service.duration; // 240 mins (4 hours)
        const STAGGER_INTERVAL = 150; // 2.5 hours

        // 3. Find existing bookings
        const allBookingsOnDate = [...bookings, ...bookingRequests]
            .filter(b => b.date === date)
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        let proposedSlotMinutes: number;

        if (allBookingsOnDate.length === 0) {
            // CASE 1: No bookings yet. Show FIRST available slot.
            proposedSlotMinutes = dayStartTime;
        } else {
            // CASE 2: Stacked bookings. Show ONE slot: 2.5h after previous booking started.
            const lastBookingStart = timeToMinutes(allBookingsOnDate[allBookingsOnDate.length - 1].time);
            proposedSlotMinutes = lastBookingStart + STAGGER_INTERVAL;
        }

        // 4. Validate Constraints
        // Constraint: Must finish before the day session ends
        if (proposedSlotMinutes + SERVICE_DURATION > dayEndTime) {
            return []; // No valid slot remaining
        }

        return [minutesToTime(proposedSlotMinutes)];
    }, [availability, bookings, bookingRequests]);

    const ownerDefinedTimeSlots = generateTimeSlots();

    const deleteMessage = async (messageId: string) => {
        await deleteDoc(doc(db, 'messages', messageId));
    };

    const deleteThread = async (threadId: string) => {
        const msgsRef = collection(db, 'messages');
        const q = query(msgsRef, where('threadId', '==', threadId));
        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(batch);
    };

    // Auto-deletion of messages older than 1 year
    useEffect(() => {
        const runRetentionPolicy = async () => {
            if (currentUser?.role !== 'owner') return;

            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const cutoff = oneYearAgo.toISOString();

            // We can query purely by date if possible, or fetch all and filter if no index
            // Ideally: where('timestamp', '<', cutoff)
            // But let's check matches on our locally synced 'messages' array? 
            // No, that depends on snapshot. Let's do a one-off query on mount.

            const msgsRef = collection(db, 'messages');
            const q = query(msgsRef, where('timestamp', '<', cutoff));

            try {
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    console.log(`Retention Policy: Deleting ${snapshot.size} old messages.`);
                    const batch = snapshot.docs.map(d => deleteDoc(d.ref));
                    await Promise.all(batch);
                }
            } catch (error) {
                // If index missing, this might fail. Fallback: silent fail or manual check
                console.warn("Retention policy check failed (likely missing index):", error);
            }
        };

        if (currentUser) {
            runRetentionPolicy();
        }
    }, [currentUser]);

    return (
        <AppContext.Provider value={{
            authStatus, currentUser, login, signup, loginWithGoogle, logout, resetPassword,
            updateUserProfile, deleteUserAccount, verifyUserEmail,
            services, bookings, bookingRequests, availability, clients, messages,
            addBookingRequest, confirmBookingRequest, declineBookingRequest, cancelBooking, updateBooking, addManualBooking,
            getCalculatedAvailableSlots, ownerDefinedTimeSlots, overwriteAvailabilityForDates, clearAvailabilityForDates, updateAvailabilitySlots,
            sendMessage, markMessageAsRead, markThreadAsRead, deleteClient, updateClientNotes,
            deleteMessage, deleteThread
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};
