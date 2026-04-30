// ==========================================
// ไฟล์: js/utils.js
// หน้าที่: เก็บฟังก์ชันตัวช่วย (Helper Functions) สำหรับจัดรูปแบบและกรองข้อมูล
// ==========================================

// ฟังก์ชัน: ดึงและจัดรูปแบบชื่อแพทย์ (ภาษาไทย)
export function getDoctorName(data) {
    if (!data || Object.keys(data).length === 0) return 'ไม่ระบุชื่อ';
    if (data.name) return data.name; // รองรับข้อมูลเก่า
    const name = `${data.pname || ''} ${data.fname || ''} ${data.lname || ''}`.trim();
    return name || 'ไม่ระบุชื่อ';
}

// ฟังก์ชัน: ดึงและจัดรูปแบบชื่อแพทย์ (ภาษาอังกฤษ)
export function getDoctorNameEN(data) {
    if (!data || Object.keys(data).length === 0) return '';
    if (data.name_en) return data.name_en; // รองรับข้อมูลเก่า
    return `${data.pname_en || ''} ${data.fname_en || ''} ${data.lname_en || ''}`.trim();
}

// ฟังก์ชัน: ระบบกรองรายชื่อแพทย์ (ใช้งานใน Search และ Dropdown)
export function filterDoctorsArray(doctorsArray, searchText, filterDept, filterSpec, deptMap) {
    const searchLower = (searchText || "").toLowerCase();
    
    return doctorsArray.filter(data => {
        const nameTH = getDoctorName(data).toLowerCase();
        const nameEN = getDoctorNameEN(data).toLowerCase();
        const deptName = (deptMap[data.dept_id] || "").toLowerCase();

        // 1. ตรวจสอบคำค้นหา (ค้นหาได้ทั้ง ชื่อไทย, ชื่ออังกฤษ และแผนก)
        if (searchLower) {
            const isMatchText = nameTH.includes(searchLower) || 
                                nameEN.includes(searchLower) || 
                                deptName.includes(searchLower);
            if (!isMatchText) return false;
        }

        // 2. ตรวจสอบแผนก (Dropdown)
        if (filterDept && data.dept_id !== filterDept) {
            return false;
        }

        // 3. ตรวจสอบความเชี่ยวชาญ (Dropdown - รองรับข้อมูลแบบ Array)
        if (filterSpec) {
            if (Array.isArray(data.specialties)) {
                if (!data.specialties.includes(filterSpec)) return false;
            } else {
                if (data.specialties !== filterSpec && data.specialty_id !== filterSpec) return false;
            }
        }

        return true;
    });
}