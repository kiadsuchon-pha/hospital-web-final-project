// js/db-service.js
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

// --- ฟังก์ชันช่วยดึงข้อมูลตาม ID (Helper) ---
async function getById(collectionName, id) {
    if (!id) return null;
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? snap.data() : null;
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
export async function getAllDoctors() {
    const snap = await getDocs(collection(db, "doctors"));
    const doctors = [];
    
    // วนลูปดึงข้อมูล และดึงชื่อแผนกมาแปะให้เลย (เพื่อเอาไปสร้าง Card)
    // หมายเหตุ: การดึงแผนกซ้ำๆ อาจช้า ถ้าข้อมูลเยอะควรใช้วิธีเก็บ dept_name ไว้ใน doctors ด้วย
    for (const d of snap.docs) {
        const docData = d.data();
        // ดึงชื่อแผนกแบบด่วนๆ เพื่อมาโชว์หน้าการ์ด
        const dept = await getById("departments", docData.dept_id);
        
        doctors.push({
            id: d.id,
            ...docData,
            deptName: dept ? dept.name : "ไม่ระบุ" 
        });
    }
    return doctors;
}

// 3. ดึงตารางเวรทั้งหมด + ชื่อหมอ + ชื่อแผนก (สำหรับแสดงหน้า index)
export async function getAllSchedulesWithDetails() {
    const snap = await getDocs(collection(db, "schedules"));
    
    // ใช้ Promise.all เพื่อดึงข้อมูลหมอมาแปะในตารางเวรแต่ละแถว
    const promises = snap.docs.map(async (docSnap) => {
        const s = docSnap.data();
        
        let docName = "ไม่ระบุ";
        let deptName = "-";
        
        // เอา doc_id ไปดึงชื่อหมอ
        if (s.doc_id) {
            const doctor = await getById("doctors", s.doc_id);
            if (doctor) {
                docName = doctor.name;
                // เอา dept_id ของหมอ ไปดึงชื่อแผนกต่อ
                const dept = await getById("departments", doctor.dept_id);
                if (dept) deptName = dept.name;
            }
        }

        return {
            id: docSnap.id,
            day: s.day,
            time: s.time,
            location: s.location,
            doctorName: docName,
            deptName: deptName
        };
    });

    return await Promise.all(promises);
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
