// ==========================================
// ไฟล์: js/admin/auth.js
// หน้าที่: ตรวจสอบสิทธิ์การเข้าใช้งาน (Authentication), จัดการระดับสิทธิ์ (RBAC) และวาดหน้าจอเริ่มต้น
// ==========================================

import { menus } from "./config.js";

// ----------------------------------------------------
// 1. ตรวจสอบการ Login (ถ้ายังไม่ล็อกอิน ให้เตะกลับไปหน้า login)
// ----------------------------------------------------
const userAuthStr = sessionStorage.getItem('hospitalAdminAuth');
if (!userAuthStr) {
    window.location.href = 'login.html';
}

// เก็บค่าข้อมูลผู้ใช้งานไว้ใน global เพื่อให้ไฟล์อื่นๆ เข้าถึงได้
window.currentUser = JSON.parse(userAuthStr);

// ----------------------------------------------------
// 2. ฟังก์ชันออกจากระบบ
// ----------------------------------------------------
window.logout = () => {
    sessionStorage.removeItem('hospitalAdminAuth');
    window.location.href = 'login.html';
};

// ----------------------------------------------------
// 3. ฟังก์ชันตั้งค่าหน้าจอตามสิทธิ์ (INITIALIZE PANEL & RBAC)
// ----------------------------------------------------
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
        const navSystem = document.getElementById('navSystem');
        if (navSystem) navSystem.style.display = 'none';
        
        const statUsersCard = document.getElementById('statUsersCard');
        if(statUsersCard) statUsersCard.style.display = 'none';

        // ลบเมนูหมวดระบบทิ้งทั้งหมด
        delete menus.system;

    } else if (window.currentUser.role === 'Admin') {
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-solid fa-user-shield"></i> Admin Panel';
        
        // สำหรับ Admin ธรรมดา: กรองเอาเมนูที่เกี่ยวข้องกับ Logs ออกไปทั้งหมด
        menus.system = menus.system.filter(m => 
            m.title !== 'ประวัติการทำงาน (Audit Logs)' && (!m.id || !m.id.startsWith('logs_'))
        );

    } else if (window.currentUser.role === 'Super Admin') {
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-solid fa-crown"></i> Super Admin Panel';
    }

    // สั่งให้วาดเมนูซ้ายมือ และเปิดหน้า Dashboard
    if (typeof window.renderSidebar === 'function') window.renderSidebar(); 
    if (typeof window.switchView === 'function') window.switchView('dashboard');
}