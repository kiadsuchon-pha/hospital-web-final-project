// js/db-service.js
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

// 🚀 CACHING LAYER - ลดการโหลดซ้ำของข้อมูลคงที่
const cache = {
    departments: null,
    doctors: null,
    locations: null,
    lastUpdateTime: 0
};

// ฟังก์ชันเช็คว่า cache ยังใหม่อยู่หรือไม่ (5 นาที = 300000ms)
const isCacheValid = () => Date.now() - cache.lastUpdateTime < 300000;

// --- ฟังก์ชันช่วยดึงข้อมูลตาม ID (Helper) ---
async function getById(collectionName, id) {
    if (!id) return null;
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? snap.data() : null;
}

// 🚀 ฟังก์ชันดึงข้อมูล Static จาก Cache (เร็วมากสำหรับข้อมูลที่ไม่เปลี่ยน)
export async function getCachedStaticData() {
    // ถ้า cache ยังใหม่ ให้ส่งกลับทันที
    if (cache.departments && cache.doctors && cache.locations && isCacheValid()) {
        return {
            departments: cache.departments,
            doctors: cache.doctors,
            locations: cache.locations
        };
    }
    
    // ถ้า cache หมดอายุ ให้ดึงมาใหม่แบบ Parallel
    const [deptSnap, docSnap, locSnap] = await Promise.all([
        getDocs(collection(db, "departments")),
        getDocs(collection(db, "doctors")),
        getDocs(collection(db, "locations"))
    ]);
    
    cache.departments = deptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.doctors = docSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.locations = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.lastUpdateTime = Date.now();
    
    return {
        departments: cache.departments,
        doctors: cache.doctors,
        locations: cache.locations
    };
}

// 🚀 ฟังก์ชันเคลียร์ Cache เมื่อข้อมูลมีการเปลี่ยนแปลง
export function clearCache() {
    cache.departments = null;
    cache.doctors = null;
    cache.locations = null;
    cache.lastUpdateTime = 0;
}

// 1. ดึงข้อมูลแพทย์ 1 คน พร้อมเชื่อมโยงตารางอื่น (Department, Position, Expertise)
export async function getDoctorFullProfile(docId) {
    // 1.1 ดึงข้อมูลแพทย์ (Doctors Table)
    const doctor = await getById("doctors", docId);
    if (!doctor) return null;

    // 1.2 เชื่อม FK: แผนก (Department)
    const dept = await getById("departments", doctor.dept_id);
    
    // 1.3 เชื่อม FK: ตำแหน่ง (Position)
    const pos = await getById("positions", doctor.pos_id);

    // 1.4 เชื่อม FK: ความเชี่ยวชาญ (Expertises - Array)
    let expertises = [];
    if (doctor.expert_ids && Array.isArray(doctor.expert_ids)) {
        // ใช้ Promise.all เพื่อดึงหลายตัวพร้อมกันให้เร็วที่สุด
        expertises = await Promise.all(doctor.expert_ids.map(id => getById("expertises", id)));
    }

    // 1.5 ดึงตารางเวร (Schedules)
    const q = query(collection(db, "schedules"), where("doc_id", "==", docId));
    const schedSnap = await getDocs(q);
    const schedules = [];
    schedSnap.forEach(s => schedules.push(s.data()));

    // รวมข้อมูลกลับเป็นก้อนเดียว (Object) เพื่อส่งให้หน้าเว็บใช้ง่ายๆ
    return {
        ...doctor,
        departmentData: dept,
        positionData: pos,
        expertiseList: expertises.filter(e => e !== null), // กรองตัวที่หาไม่เจอทิ้ง
        scheduleList: schedules
    };
}

// 2. ดึงแพทย์ทั้งหมด (สำหรับหน้า doctors.html)
// 🚀 OPTIMIZED: ดึงแผนกครั้งเดียว แล้วใช้ Map แทนดึงซ้ำๆ (ลดจาก N+1 → 2 queries)
export async function getAllDoctors() {
    const [docSnap, deptSnap] = await Promise.all([
        getDocs(collection(db, "doctors")),
        getDocs(collection(db, "departments"))
    ]);
    
    // สร้าง Map ของแผนกเพื่อค้นหาแบบ O(1) แทน O(N)
    const deptMap = {};
    deptSnap.forEach(d => {
        deptMap[d.id] = d.data().name;
    });
    
    // แปลงเป็น Array ครั้งเดียว
    const doctors = docSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        deptName: deptMap[d.data().dept_id] || "ไม่ระบุ" 
    }));
    
    return doctors;
}

// 3. ดึงตารางเวรทั้งหมด + ชื่อหมอ + ชื่อแผนก (สำหรับแสดงหน้า index)
// 🚀 OPTIMIZED: ดึง schedules, doctors, departments พร้อมกัน แล้วใช้ Map (ลดจาก N*M queries → 3 queries)
export async function getAllSchedulesWithDetails() {
    const [schedSnap, docSnap, deptSnap] = await Promise.all([
        getDocs(collection(db, "schedules")),
        getDocs(collection(db, "doctors")),
        getDocs(collection(db, "departments"))
    ]);
    
    // สร้าง Maps สำหรับค้นหาแบบ O(1)
    const doctorMap = {};
    docSnap.forEach(d => {
        const data = d.data();
        doctorMap[d.id] = {
            name: data.name,
            deptId: data.dept_id
        };
    });
    
    const deptMap = {};
    deptSnap.forEach(d => {
        deptMap[d.id] = d.data().name;
    });
    
    // แปลงครั้งเดียวโดยใช้ Maps
    return schedSnap.docs.map(docSnap => {
        const s = docSnap.data();
        const doctor = doctorMap[s.doc_id];
        
        return {
            id: docSnap.id,
            day: s.day,
            time: s.time,
            location: s.location,
            doctorName: doctor?.name || "ไม่ระบุ",
            deptName: doctor ? (deptMap[doctor.deptId] || "-") : "-"
        };
    });
}

// 4. ดึงข้อมูลสรุปสถานะการเปิด-ปิด ของแต่ละแผนก (Weekly Summary)
export async function getDepartmentWeeklyStatus() {
    // ดึงข้อมูลดิบ 3 ตารางมาประมวลผลร่วมกัน
    const [deptsSnap, docsSnap, schedsSnap] = await Promise.all([
        getDocs(collection(db, "departments")),
        getDocs(collection(db, "doctors")),
        getDocs(collection(db, "schedules"))
    ]);

    // 1. เตรียมโครงสร้างข้อมูลแผนก (Map)
    // ผลลัพธ์จะเป็น: { "dept_med": { name: "อายุรกรรม", days: { "จันทร์": [], "อังคาร": [] } } }
    const deptMap = {};
    deptsSnap.forEach(d => {
        deptMap[d.id] = {
            id: d.id,
            name: d.data().name,
            icon: d.data().icon,
            days: {} // เก็บเวลาของแต่ละวัน
        };
    });

    // 2. สร้าง Map เพื่อแปลง doc_id -> dept_id
    const docToDept = {};
    docsSnap.forEach(d => {
        docToDept[d.id] = d.data().dept_id;
    });

    // 3. วนลูปตารางเวร เพื่อยัดเวลาใส่แผนก
    schedsSnap.forEach(s => {
        const data = s.data();
        const deptId = docToDept[data.doc_id]; // ดูว่าหมอคนนี้อยู่แผนกไหน
        
        // ถ้าข้อมูลถูกต้องและมีแผนกนี้อยู่จริง
        if (deptId && deptMap[deptId]) {
            // แยกวัน (กรณีใส่ว่า "จันทร์-ศุกร์" อาจจะต้องทำ Logic เพิ่ม แต่อันนี้เอาแบบพื้นฐานตามชื่อวันเป๊ะๆ ก่อน)
            // สมมติใน db เก็บ "จันทร์", "พุธ" (String ตรงตัว)
            const dayKey = data.day; 
            
            if (!deptMap[deptId].days[dayKey]) {
                deptMap[deptId].days[dayKey] = new Set();
            }
            // เก็บช่วงเวลาลงไป (เช่น "08:00 - 16:00")
            deptMap[deptId].days[dayKey].add(data.time);
        }
    });

    return Object.values(deptMap);
}
