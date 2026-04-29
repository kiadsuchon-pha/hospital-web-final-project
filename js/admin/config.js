// ==========================================
// ไฟล์: js/admin/config.js
// ==========================================
export const SHIFTS = {
    '1': { label: 'เช้า (08:00 - 12:00)', time: '08:00 - 12:00' },
    '2': { label: 'บ่าย (13:00 - 16:00)', time: '13:00 - 16:00' }
};

export const schemas = {
    doctors: {
        title: "แพทย์",
        fields: [
            { key: "id", label: "ID", type: "text", isId: true },
            { key: "profile_image", label: "รูปโปรไฟล์", type: "image" },
            { key: "pname", label: "คำนำหน้า (TH)", type: "select" },
            { key: "fname", label: "ชื่อจริง (TH)", type: "text", required: true },
            { key: "lname", label: "นามสกุล (TH)", type: "text", required: true },
            { key: "pname_en", label: "คำนำหน้า (EN)", type: "select" },
            { key: "fname_en", label: "ชื่อจริง (EN)", type: "text" },
            { key: "lname_en", label: "นามสกุล (EN)", type: "text" },
            { key: "specialties", label: "ความเชี่ยวชาญ", type: "dynamic_multi_select", isArray: true },
            { key: "license_id", label: "เลขที่ใบอนุญาต (ว.)", type: "text" },
            { key: "dept_id", label: "แผนก", type: "text" },
            { key: "edu", label: "วุฒิการศึกษา", type: "dynamic_multi_text", isArray: true },
            { key: "research", label: "บทความวิจัย", type: "dynamic_multi_text", isArray: true, hideInTable: true }
        ]
    },
    departments: { title: "แผนก", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "ชื่อแผนก", type: "text" }, { key: "icon", label: "Icon", type: "text" }, { key: "is_active", label: "เปิดใช้งาน", type: "switch" }] },
    locations: { title: "ห้อง/สถานที่", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "ชื่อห้อง", type: "text", required: true }, { key: "description", label: "คำอธิบาย", type: "text" }] },
    prefixes_th: { title: "คำนำหน้าชื่อ (TH)", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "คำนำหน้า (TH)", type: "text", required: true }] },
    prefixes_en: { title: "คำนำหน้าชื่อ (EN)", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "คำนำหน้า (EN)", type: "text", required: true }] },
    specialties: { title: "ความเชี่ยวชาญ", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "ชื่อความเชี่ยวชาญ", type: "text", required: true }] },
    positions: { title: "ตำแหน่ง", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "name", label: "ตำแหน่ง", type: "text", required: true }] },
    contact_info: { title: "ข้อมูลติดต่อ", fields: [{ key: "id", label: "ID", type: "text", isId: true }, { key: "address", label: "ที่อยู่", type: "text", required: true }, { key: "phone", label: "เบอร์โทรศัพท์", type: "text", required: true }, { key: "map_url", label: "ลิงก์แผนที่", type: "text" }] },
    users: {
        title: "บัญชีผู้ใช้",
        fields: [
            { key: "id", label: "ID", type: "text", isId: true },
            { key: "username", label: "ชื่อผู้ใช้ (Username)", type: "text", required: true },
            { key: "password", label: "รหัสผ่าน (Password)", type: "text", required: true },
            { key: "display_name", label: "ชื่อ-นามสกุล", type: "text", required: true },
            { key: "role", label: "ระดับสิทธิ์ (Role)", type: "select", options: ["Super Admin", "Admin", "Secretary"] },
            { key: "is_active", label: "เปิดใช้งาน", type: "switch" }
        ]
    }
};

export const menus = {
    data: [
        { type: 'header', title: 'ภาพรวมระบบ' },
        { id: 'dashboard', name: 'Dashboard สถิติ', icon: 'fa-chart-pie' },
        { type: 'header', title: 'บุคลากรทางการแพทย์' },
        { id: 'doctors', name: 'แพทย์', icon: 'fa-user-doctor' },
        { type: 'header', title: 'โครงสร้างโรงพยาบาล' },
        { id: 'departments', name: 'แผนก', icon: 'fa-hospital' },
        { id: 'locations', name: 'ห้อง/สถานที่', icon: 'fa-map-location-dot' },
        { type: 'header', title: 'ข้อมูลพื้นฐาน' },
        { id: 'specialties', name: 'ความเชี่ยวชาญ', icon: 'fa-star' },
        { id: 'positions', name: 'ตำแหน่ง', icon: 'fa-id-badge' },
        { id: 'prefixes_th', name: 'คำนำหน้าชื่อ (TH)', icon: 'fa-heading' },
        { id: 'prefixes_en', name: 'คำนำหน้าชื่อ (EN)', icon: 'fa-font' }
    ],
    tools: [
        { type: 'header', title: 'การจัดการเวลา' },
        { id: 'scheduleManager', name: 'จัดการตารางเวรแพทย์', icon: 'fa-calendar-days' }
    ],
    system: [
        { type: 'header', title: 'การจัดการระบบ' },
        { id: 'users', name: 'จัดการบัญชีผู้ใช้', icon: 'fa-users-gear' },
        { id: 'import', name: 'นำเข้าข้อมูล (Import)', icon: 'fa-cloud-upload' },
        { type: 'header', title: 'ประวัติการทำงาน (Audit Logs)' },
        { id: 'logs_data', name: 'ประวัติการแก้ไขข้อมูล', icon: 'fa-file-signature' },
        { id: 'logs_schedule', name: 'ประวัติการจัดเวร', icon: 'fa-calendar-plus' },
        { id: 'logs_system', name: 'ประวัติบัญชีผู้ใช้', icon: 'fa-user-clock' }
    ]
};