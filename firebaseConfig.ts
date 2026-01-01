
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLcmSXzWtpYOZW-nZ9z6F1-d_RZOT7358",
  authDomain: "silkhair-straightening-backend.firebaseapp.com",
  projectId: "silkhair-straightening-backend",
  storageBucket: "silkhair-straightening-backend.firebasestorage.app",
  messagingSenderId: "377543936144",
  appId: "1:377543936144:web:beaef0b54051e5a9c5f015",
  measurementId: "G-1SY2LS430C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
