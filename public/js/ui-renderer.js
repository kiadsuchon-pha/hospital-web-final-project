// สร้างการ์ดแพทย์ (ใช้ใน doctors.html)
export function createDoctorCard(doc) {
    const icon = doc.icon || "fa-user-doctor";
    return `
        <div class="doctor-card" data-dept="${doc.deptName}" data-name="${doc.name}">
            <div class="doctor-img"><i class="fa-solid ${icon}"></i></div>
            <h3>${doc.name}</h3>
            <span class="dept-badge">${doc.deptName}</span><br>
            <a href="doctor-detail.html?id=${doc.id}" class="btn-book">ดูประวัติ</a>
        </div>
    `;
}

// สร้างรายการตารางเวร (ใช้ใน doctor-detail.html)
export function renderScheduleRows(schedules) {
    if (!schedules || schedules.length === 0) return "<tr><td colspan='3'>ไม่พบตารางเวร</td></tr>";
    
    return schedules.map(s => `
        <tr>
            <td><strong>${s.day}</strong></td>
            <td>${s.time}</td>
            <td>${s.location}</td>
        </tr>
    `).join("");
}

// สร้างรายการ List (ใช้สำหรับ Expertises / Education)
export function renderList(items) {
    if (!items || items.length === 0) return "<li>ไม่มีข้อมูล</li>";
    
    // เช็คว่าเป็น Object (จาก expertise) หรือ String (จาก edu)
    return items.map(item => {
        const text = typeof item === 'object' ? item.name : item;
        return `<li>${text}</li>`;
    }).join("");
}

// สร้างแถวตาราง OPD (ใช้ใน index.html)
export function renderOpdRow(item) {
    return `
        <tr>
            <td><span style="font-weight:bold; color:#555;">${item.day}</span></td>
            <td>${item.time}</td>
            <td style="color:#0066cc; font-weight:600;">${item.doctorName}</td>
            <td><span class="dept-badge" style="font-size:0.8rem; padding:3px 10px;">${item.deptName}</span></td>
            <td>${item.location}</td>
        </tr>
    `;
}