import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Kiểm tra xem có biến môi trường Firebase thật không
const hasRealConfig = import.meta.env.VITE_FIREBASE_API_KEY;

let app = null;
let auth = null;
let db = null;
let storage = null;

if (hasRealConfig) {
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } catch (error) {
        console.warn('Firebase initialization failed:', error);
    }
} else {
    console.log('%c🔧 DocStudio: Running in MOCK MODE (no Firebase credentials found)', 'color: #6366f1; font-weight: bold; font-size: 14px;');
}

export { auth, db, storage };

