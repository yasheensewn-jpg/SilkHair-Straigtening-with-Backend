
export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
  description: string;
}

export interface Booking {
  id: string;
  service: Service;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerNotes?: string;
  ownerNotes?: string; // Visible only to the owner
  duration?: number; // Optional custom duration in minutes
  source?: 'manual' | 'online';
}

export interface Client {
  id: string; // Will use email
  name: string;
  email: string;
  phoneNumber?: string;
  phone?: string; // Keeping for backward compatibility if needed, though phoneNumber is preferred for mobile
  dob: string; // Date of Birth
  password: string; // Stored for simplicity; in real-world, this would be a hash
  bookings: Booking[];
  lastSeen: string;
  role: 'user';
  ownerNotes?: string; // Private notes for the owner about this client
  emailVerified: boolean; // New field for auth flow
  photo?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'owner';
  photo?: string;
  phoneNumber?: string;
}

export type User = Client | Owner;

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
  threadId: string; // Used to group messages into conversations
}

export enum ViewMode {
  USER = 'user',
  OWNER = 'owner',
}