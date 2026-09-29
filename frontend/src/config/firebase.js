import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
].every(value => typeof value === 'string' && value.trim().length > 0);

// Keep the setup page renderable when local Firebase variables are absent or invalid.
let app = null;
let auth = null;
let isFirebaseConfigured = false;
if (hasFirebaseValues) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    isFirebaseConfigured = true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}
export { auth, isFirebaseConfigured };
export default app;
