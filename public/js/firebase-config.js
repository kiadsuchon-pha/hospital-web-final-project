// 1. นำเข้า Firebase SDK (เปลี่ยนจาก getFirestore เป็น initializeFirestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; // เปลี่ยนบรรทัดนี้

const firebaseConfig = {
  apiKey: "AIzaSyDZmBs0xzB0Ji5QE1ZnPb--VQobzhE15Z0",
  authDomain: "hospital-web-82f02.firebaseapp.com",
  projectId: "hospital-web-82f02",
  storageBucket: "hospital-web-82f02.firebasestorage.app",
  messagingSenderId: "1085552526309",
  appId: "1:1085552526309:web:659b4dbdfd61ca693d250c",
  measurementId: "G-KQYXZS2JQN"
};

const app = initializeApp(firebaseConfig);

// 🌟 2. ใช้ initializeFirestore เพื่อบังคับเปิด Long Polling ป้องกันปัญหา Network Block
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

export { db };