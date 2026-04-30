// ไฟล์: firebase-config.js

// 1. นำเข้า Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. ค่า Config ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyDZmBs0xzB0Ji5QE1ZnPb--VQobzhE15Z0",
  authDomain: "hospital-web-82f02.firebaseapp.com",
  projectId: "hospital-web-82f02",
  storageBucket: "hospital-web-82f02.firebasestorage.app",
  messagingSenderId: "1085552526309",
  appId: "1:1085552526309:web:659b4dbdfd61ca693d250c",
  measurementId: "G-KQYXZS2JQN"
};

// 3. เริ่มต้นระบบ Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. ส่งออกตัวแปร db ให้ไฟล์อื่นเรียกใช้ได้
export { db };