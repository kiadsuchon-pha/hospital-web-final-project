// ==========================================
// ไฟล์: js/admin/logger.js
// หน้าที่: บันทึกและดึงข้อมูลประวัติการทำงาน (Audit Logs) แยกหมวดหมู่
// ==========================================
import { collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-config.js";

// --- บันทึกประวัติการกระทำของผู้ใช้งาน ส่งขึ้น Firestore พร้อมระบุหมวดหมู่ ---
window.saveLog = async (action, details, category = 'data') => {
    try {
        if (!window.currentUser) return;
        await addDoc(collection(db, "audit_logs"), {
            timestamp: new Date().toISOString(),
            user_name: window.currentUser.display_name,
            user_role: window.currentUser.role,
            action: action,
            details: details,
            category: category // เก็บหมวดหมู่ลงฐานข้อมูล
        });
    } catch (e) { console.error("Log error:", e); }
};

// --- ดึงประวัติการทำงานตามหมวดหมู่ (category) นำมาแสดงผลในตาราง และเปลี่ยนสีกรอบข้อความตามประเภท ---
window.loadLogs = async (category) => {
    // เปลี่ยนชื่อหัวข้อตามหมวดหมู่
    const titles = {
        'data': 'ประวัติการแก้ไขข้อมูลพื้นฐาน',
        'schedule': 'ประวัติการจัดตารางเวร',
        'system': 'ประวัติระบบและบัญชีผู้ใช้'
    };
    document.getElementById('logPageTitle').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${titles[category]}`;
    
    const tbody = document.getElementById('logsBody');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" align="center">กำลังโหลด...</td></tr>`;
    
    try {
        // ดึงข้อมูลล่าสุดมา 300 รายการ แล้วค่อยมากรองฝั่งเว็บ (เพื่อป้องกัน Error จาก Firestore Index)
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(300));
        const snap = await getDocs(q);
        let html = "";
        let count = 0;
        
        snap.forEach(doc => {
            const d = doc.data();
            const docCat = d.category || 'data'; // ถ้าข้อมูลเก่าไม่มีหมวด ให้ถือว่าเป็น data
            
            // ถ้าหมวดหมู่ไม่ตรงกับหน้าที่เปิดอยู่ ให้ข้ามไปเลย
            if(docCat !== category) return;
            
            count++;
            const dateObj = new Date(d.timestamp);
            const dateStr = dateObj.toLocaleDateString('th-TH') + ' ' + dateObj.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
            
            let actionColor = "#6c757d"; 
            if(d.action.includes('เพิ่ม') || d.action.includes('เปิด') || d.action.includes('อัตโนมัติ')) actionColor = "#28a745"; 
            else if(d.action.includes('แก้ไข') || d.action.includes('อัปเดต') || d.action.includes('เปลี่ยน')) actionColor = "#fd7e14"; 
            else if(d.action.includes('ลบ') || d.action.includes('ปิด') || d.action.includes('ยกเลิก') || d.action.includes('ล้าง')) actionColor = "#dc3545"; 

            html += `<tr>
                <td>${dateStr}</td>
                <td><strong style="color:var(--primary);">${d.user_name}</strong> <br><small style="color:#888;">(${d.user_role})</small></td>
                <td><span style="background:${actionColor}15; color:${actionColor}; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.85rem;">${d.action}</span></td>
                <td>${d.details}</td>
            </tr>`;
        });
        tbody.innerHTML = count > 0 ? html : `<tr><td colspan="4" align="center">ยังไม่มีประวัติการทำงานในหมวดนี้</td></tr>`;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" align="center" style="color:red;">เกิดข้อผิดพลาดในการโหลด Logs</td></tr>`;
    }
};