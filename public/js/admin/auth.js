// ==========================================
// ไฟล์: js/admin/auth.js
// ==========================================

import { menus } from "./config.js";

// --- เช็คว่ามี Token / Session ไหม ถ้าไม่มีเด้งไปหน้าล็อกอิน ---
const userAuthStr = sessionStorage.getItem('hospitalAdminAuth');
if (!userAuthStr) {
    window.location.href = 'login.html';
}

window.currentUser = JSON.parse(userAuthStr);

// --- เคลียร์ Session เพื่อออกจากระบบ ---
window.logout = () => {
    sessionStorage.removeItem('hospitalAdminAuth');
    window.location.href = 'login.html';
};

// --- ตรวจสอบ Role ของผู้ใช้ และกรองเอาเมนูที่ไม่มีสิทธิ์เข้าถึงออกไป รวมถึงเปลี่ยนชื่อโลโก้และข้อความต้อนรับ ---
export function initAdminPanel() {
    const nameDisplay = document.getElementById('displayUserName');
    const roleDisplay = document.getElementById('displayUserRole');
    const brandLogo = document.querySelector('.brand'); 
    
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.innerText = `ยินดีต้อนรับ, ${window.currentUser.display_name}`;
    
    if (nameDisplay) nameDisplay.innerText = window.currentUser.display_name;
    if (roleDisplay) roleDisplay.innerText = `(${window.currentUser.role})`;

    // --- กฎการจำกัดสิทธิ์ (Role-Based Access Control) ---
    if (window.currentUser.role === 'Secretary') {
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-solid fa-user-nurse"></i> Secretary Panel';
        
        // ซ่อนแท็บระบบ (System)
        const navSystem = document.getElementById('navSystem');
        if (navSystem) navSystem.style.display = 'none';
        
        const statUsersCard = document.getElementById('statUsersCard');
        if(statUsersCard) statUsersCard.style.display = 'none';

        // 🌟 1. ซ่อนหมวด "ข้อมูลพื้นฐาน" สำหรับ Secretary
        const basicInfoIds = ['specialties', 'prefixes_th', 'prefixes_en'];
        menus.data = menus.data.filter(m => 
            m.title !== 'ข้อมูลพื้นฐาน' && !basicInfoIds.includes(m.id)
        );

        // ลบเมนูหมวดระบบทิ้งทั้งหมด
        delete menus.system;

    } else if (window.currentUser.role === 'Admin') {
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-solid fa-user-shield"></i> Admin Panel';
        menus.system = menus.system.filter(m => 
            m.title !== 'ประวัติการทำงาน (Audit Logs)' && (!m.id || !m.id.startsWith('logs_'))
        );

    } else if (window.currentUser.role === 'Super Admin') {
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-solid fa-crown"></i> Super Admin Panel';
    }

    if (typeof window.renderSidebar === 'function') window.renderSidebar(); 
    if (typeof window.switchView === 'function') window.switchView('dashboard');
}