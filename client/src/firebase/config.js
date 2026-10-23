import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5001';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  auth: (cb) => {
    cb({ token: localStorage.getItem('token') });
  }
});

// Mock configuration (legacy credentials removed; active calls use Express REST API & Socket.io)
const firebaseConfig = {};

let app, auth, db, storage;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = {};
  storage = {};
} catch (e) {
  db = {};
  auth = {};
  storage = {};
}

export { app, auth, db, storage };
export default { socket, app, auth, db, storage };
