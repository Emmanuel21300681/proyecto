// config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Configuración proporcionada por Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCqL19JlWeUzDk6QVPeuYGp3cdHQVlB4zI",
  authDomain: "athleticxs-7af6a.firebaseapp.com",
  projectId: "athleticxs-7af6a",
  storageBucket: "athleticxs-7af6a.firebasestorage.app",
  messagingSenderId: "799871479390",
  appId: "1:799871479390:web:05583a4e041d1bd0298ecf",
  measurementId: "G-3CBDN0CB2W"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const db = getFirestore(app); // Para Firestore
const storage = getStorage(app); // Para Storage
const analytics = getAnalytics(app); // Para Analytics (opcional, si lo usas)

export { app, db, storage, analytics };