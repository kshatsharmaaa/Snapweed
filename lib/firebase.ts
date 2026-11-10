import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCkH23YMjxEjhJx_U5kmTi69ysFRftKFOg",
  authDomain: "snapweed.firebaseapp.com",
  projectId: "snapweed",
  storageBucket: "snapweed.firebasestorage.app",
  messagingSenderId: "888462218149",
  appId: "1:888462218149:web:a0e99f511552a982128e4c"
};

// Initialize Firebase
// Initialize Firebase safely for Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
