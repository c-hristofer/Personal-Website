import { initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    browserSessionPersistence,
    initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStoredRememberMe } from "./utils/remember-me";

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

// Firebase config using environment variables
const firebaseConfig = {
    apiKey: env.REACT_APP_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID
};

// Optional: Log if any env variables are missing
for (const [key, value] of Object.entries(firebaseConfig)) {
    if (!value) {
        console.warn(`Missing Firebase config value: ${key}`);
    }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let auth;
const preferLocal = getStoredRememberMe();
try {
    auth = initializeAuth(app, {
        persistence: preferLocal ? browserLocalPersistence : browserSessionPersistence,
    });
} catch (error) {
    console.warn('Falling back to session persistence during Firebase initialization.', error);
    auth = initializeAuth(app, {
        persistence: browserSessionPersistence,
    });
}
const db = getFirestore(app);

export { app, db, auth };
