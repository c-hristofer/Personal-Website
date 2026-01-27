import { initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    browserSessionPersistence,
    initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStoredRememberMe } from "./utils/remember-me";

// Firebase config using environment variables
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
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
