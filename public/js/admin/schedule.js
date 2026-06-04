// ==========================================
// ไฟล์: js/admin/schedule.js
// ==========================================
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-config.js";
import { getDoctorName } from "../utils.js";
import { getCachedStaticData } from "../db-service.js";
import { SHIFTS } from "./config.js";

window.currentScheduleMode = 'current';
let currentAssignTarget = null;

let scheduleDataCache = { current: null, next: null };
let currentScheduleLoadId = 0;

window.clearScheduleCache = () => {
    scheduleDataCache = { current: null, next: null };
};

const getCollections = () => {
    return {
        opdColl: window.currentScheduleMode === 'next' ? "opd_schedules_next" : "opd_schedules",
        docColl: window.currentScheduleMode === 'next' ? "doctor_schedules_next" : "doctor_schedules"
    };
};

window.switchScheduleMode = (mode) => {
    window.currentScheduleMode = mode;
    document.querySelectorAll('.schedule-sub-view').forEach(d => d.classList.remove('active'));
    
    if (mode === 'current') {
        document.getElementById('scheduleCurrentContainer').classList.add('active');
    } else {
        document.getElementById('scheduleNextContainer').classList.add('active');
    }
    window.loadScheduleManager();
}

window.loadScheduleFilterOptions = async function () {
    const gridDept = document.getElementById('schedFilterDept');
    const nextGridDept = document.getElementById('nextSchedFilterDept');

    const { departments } = await getCachedStaticData();
    const opts = '<option value="">-- ทั้งหมด --</option>' + departments
        .filter(d => d.is_active !== false)
        .map(d => `<option value="${d.id}">${d.name}</option>`)
        .join('');

    if (gridDept) gridDept.innerHTML = opts;
    if (nextGridDept) nextGridDept.innerHTML = opts;
}

window.loadScheduleManager = async () => {
    const gridBodyId = window.currentScheduleMode === 'next' ? 'nextGridBody' : 'gridBody';
    const gridBody = document.getElementById(gridBodyId);
    if (!gridBody) return;
    
    const filterId = window.currentScheduleMode === 'next' ? 'nextSchedFilterDept' : 'schedFilterDept';
    const targetFilter = document.getElementById(filterId)?.value || "";
    const loadId = ++currentScheduleLoadId; 
    
    if (!scheduleDataCache[window.currentScheduleMode]) {
        gridBody.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="loader"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดตาราง...</div></td></tr>`;
    }
    
    try {
        const { opdColl, docColl } = getCollections();
        let opdSnap, docSchSnap;
        const { departments, doctors, locations } = await getCachedStaticData();

        if (scheduleDataCache[window.currentScheduleMode]) {
            opdSnap = scheduleDataCache[window.currentScheduleMode].opdSnap;
            docSchSnap = scheduleDataCache[window.currentScheduleMode].docSchSnap;
        } else {
            [opdSnap, docSchSnap] = await Promise.all([
                getDocs(collection(db, opdColl)),
                getDocs(collection(db, docColl))
            ]);
            if (loadId !== currentScheduleLoadId) return;
            scheduleDataCache[window.currentScheduleMode] = { opdSnap, docSchSnap };
        }

        let filteredDepts = departments.filter(d => d.is_active !== false);
        if (targetFilter) filteredDepts = filteredDepts.filter(d => d.id === targetFilter);
        
        const doctorsMap = {};
        doctors.forEach(d => doctorsMap[d.id] = getDoctorName(d));
        const locationsMap = {};
        locations.forEach(d => locationsMap[d.id] = d.name);
        
        const scheduleMap = {};
        opdSnap.forEach(doc => { 
            const d = doc.data(); 
            d.id = doc.id;
            if (!scheduleMap[d.dept_id]) scheduleMap[d.dept_id] = {}; 
            if (!scheduleMap[d.dept_id][d.day]) scheduleMap[d.dept_id][d.day] = {}; 
            scheduleMap[d.dept_id][d.day][d.shift] = { opdData: d, assignments: [] }; 
        });
        
        docSchSnap.forEach(doc => { 
            const d = doc.data(); 
            if (scheduleMap[d.dept_id]?.[d.day]?.[d.shift]) { 
                scheduleMap[d.dept_id][d.day][d.shift].assignments.push({ id: doc.id, ...d }); 
            }
        });

        if (loadId !== currentScheduleLoadId) return;

        let html = ""; 
        const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์"];
        
        filteredDepts.forEach(dept => {
            html += `<tr><td style="font-weight:bold;"><i class="fa-solid ${dept.icon || 'fa-hospital'}"></i> ${dept.name}</td>`;
            days.forEach(day => {
                html += `<td class="sched-cell">`;
                ['1', '2'].forEach(shift => {
                    const data = scheduleMap[dept.id]?.[day]?.[shift];
                    html += `<div class="shift-block ${data ? 'active' : 'inactive'}">
                        <div class="shift-header"><small>${shift === '1' ? '🌅 เช้า' : '🌇 บ่าย'}</small>
                        <label class="switch"><input type="checkbox" ${data ? 'checked' : ''} onchange="toggleOpdMaster(this,'${dept.id}','${dept.name}','${day}','${shift}')"><span class="slider round"></span></label></div>`;
                    if (data) {
                        html += `<div style="font-size:0.75rem; color:#666; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span><i class="fa-solid fa-location-dot"></i> ${locationsMap[data.opdData.location_id] || '-'}</span>
                            <i class="fa-solid fa-pen-to-square" style="cursor:pointer; color:var(--primary); font-size: 0.85rem;" title="เปลี่ยนห้อง" onclick="openChangeRoomModal('${data.opdData.id}', '${dept.id}', '${dept.name}', '${day}', '${shift}', '${data.opdData.location_id}')"></i>
                        </div>`;

                        if (data.assignments.length > 0) {
                            data.assignments.forEach(assign => {
                                const docName = doctorsMap[assign.doc_id]?.replace(/'/g, "\\'") || "แพทย์";
                                html += `<div class="doc-assigned" style="margin-top:4px;">
                                    <div class="text-truncate" title="${doctorsMap[assign.doc_id]}">${doctorsMap[assign.doc_id]}</div>
                                    <i class="fa-solid fa-xmark btn-remove-doc" onclick="removeDoctor('${assign.id}', '${docName}', '${dept.name}', '${day}')"></i>
                                </div>`;
                            });
                        }
                        html += `<button class="btn-assign" style="margin-top:5px;" onclick="openAssignModal('${dept.id}','${day}','${shift}','${dept.name}','${data.opdData.location_id}')">+ เพิ่มแพทย์</button>`;
                    } else html += `<div class="closed-text">ปิด</div>`;
                    html += `</div>`;
                });
                html += `</td>`;
            });
            html += `</tr>`;
        });
        
        gridBody.innerHTML = html || `<tr><td colspan="6" align="center" style="padding: 50px;">ไม่พบข้อมูลแผนก</td></tr>`;
    } catch (e) { 
        if (loadId !== currentScheduleLoadId) return; 
        console.error("Load Error:", e);
        gridBody.innerHTML = `<tr><td colspan="6" align="center" style="padding: 50px; color: #dc3545;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
            <b>ไม่สามารถโหลดข้อมูลได้</b><br>
            <button onclick="window.clearScheduleCache(); loadScheduleManager();" class="btn-edit" style="margin-top:10px; cursor:pointer;">
                <i class="fa-solid fa-rotate-right"></i> ลองใหม่อีกครั้ง
            </button>
        </td></tr>`;
    }
}

// 🌟 อัปเดตตรรกะจัดเวรอัตโนมัติ (บังคับกฎจัดเวร 2 คน และข้ามกะที่มีคนอยู่แล้ว)
window.autoAssignSchedules = async () => {
    if (!confirm("✨ จัดเวรอัตโนมัติในช่องที่ว่างหรือไม่?\n\n(ระบบจะจัดทีม 2 คนต่อกะ, ถ้ายกะไหนมีแพทย์อยู่แล้วจะไม่จัดเพิ่ม, ทำงานไม่เกิน 2 กะติดกัน, และเว้นพัก 8-16 ชม.)")) return;
    try {
        const btn = document.querySelector('button[onclick="autoAssignSchedules()"]');
        const originalText = btn.innerHTML; 
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังคำนวณ...`; 
        btn.disabled = true;

        const { opdColl, docColl } = getCollections();
        const [opdSnap, docSchSnap, staticData] = await Promise.all([
            getDocs(collection(db, opdColl)),
            getDocs(collection(db, docColl)),
            getCachedStaticData()
        ]);
        const doctorsSnap = staticData.doctors;

        const doctorsByDept = {};
        const shiftCounts = {}; 
        
        // แปลงตาราง 5 วัน 2 กะ ให้เป็น Array 10 ช่อง (0 ถึง 9) เพื่อเช็คการทำงานติดกัน
        const tracker = {}; 
        const dayMap = { "จันทร์": 0, "อังคาร": 1, "พุธ": 2, "พฤหัส": 3, "ศุกร์": 4 };
        const getShiftIndex = (day, shift) => (dayMap[day] * 2) + (shift === '1' ? 0 : 1);

        doctorsSnap.forEach(d => {
            shiftCounts[d.id] = 0;
            tracker[d.id] = new Array(10).fill(false);
            
            let deptArr = Array.isArray(d.dept_id) ? d.dept_id : (d.dept_id ? [d.dept_id] : []);
            deptArr.forEach(dept => {
                if (!doctorsByDept[dept]) doctorsByDept[dept] = [];
                doctorsByDept[dept].push(d.id);
            });
        });

        // นับจำนวนหมอที่มีอยู่แล้วในแต่ละห้อง (Room)
        const roomAssignedCounts = {};
        
        docSchSnap.forEach(d => {
            const data = d.data();
            const sIndex = getShiftIndex(data.day, data.shift);
            if (tracker[data.doc_id]) {
                tracker[data.doc_id][sIndex] = true;
                shiftCounts[data.doc_id]++;
            }
            const roomKey = `${data.dept_id}_${data.day}_${data.shift}_${data.location_id}`;
            roomAssignedCounts[roomKey] = (roomAssignedCounts[roomKey] || 0) + 1;
        });

        const promises = []; 
        let count = 0;
        
        opdSnap.forEach(d => {
            const opd = d.data(); 
            const roomKey = `${opd.dept_id}_${opd.day}_${opd.shift}_${opd.location_id}`;
            const sIndex = getShiftIndex(opd.day, opd.shift);
            
            let currentAssigned = roomAssignedCounts[roomKey] || 0;
            
            // 🚨 ตรรกะใหม่: ถ้าในกะนี้มีแพทย์อยู่แล้ว จะข้ามและไม่จัดเพิ่มเด็ดขาด
            if (currentAssigned > 0) {
                return; // การ return ใน forEach ทำหน้าที่เหมือน continue ข้ามไปทำห้องต่อไป
            }
            
            // 🚨 ตรรกะใหม่: จัดทีมลงกะว่างให้ได้ 2 คนถ้วนๆ
            let needed = 2;
            
            if (needed > 0) {
                let availableDocs = (doctorsByDept[opd.dept_id] || []).filter(id => {
                    const w = tracker[id];
                    if (w[sIndex]) return false; // ติดเวรที่อื่นในเวลานี้แล้ว
                    
                    // กฎเหล็ก: ห้ามเข้ากะติดต่อกันเกิน 2 กะ (เว้นพัก 1 กะ = 8-16 ชม.)
                    // 1. ถ้าย้อนกลับไป 2 กะ ทำงานติดกันมาแล้ว -> กะนี้ห้ามทำ (ต้องพัก)
                    if (sIndex >= 2 && w[sIndex-1] && w[sIndex-2]) return false;
                    // 2. ถ้าในอนาคต 2 กะ โดนลงเวรไว้แล้ว -> กะนี้ห้ามทำ (เดี๋ยวจะติดกัน 3 กะ)
                    if (sIndex <= 7 && w[sIndex+1] && w[sIndex+2]) return false;
                    // 3. ถ้ากะก่อนหน้า และกะถัดไป ทำงานอยู่ -> กะนี้ห้ามทำ (ตรงกลางเป็นแซนวิชรวมเป็น 3)
                    if (sIndex >= 1 && sIndex <= 8 && w[sIndex-1] && w[sIndex+1]) return false;
                    
                    return true;
                });

                // เรียงให้คนที่เวรน้อยสุดได้ก่อน (Load Balancing)
                availableDocs.sort((a, b) => {
                    if (shiftCounts[a] === shiftCounts[b]) return 0.5 - Math.random();
                    return shiftCounts[a] - shiftCounts[b];
                });

                // จัดหมอลงเวรตามจำนวนที่ขาด (ถ้าหมอเหลือให้ลงน้อยกว่า needed ก็ลงเท่าที่มี)
                for (let i = 0; i < needed && i < availableDocs.length; i++) {
                    const selectedDoc = availableDocs[i];
                    promises.push(setDoc(doc(db, docColl, `assign_auto_${Date.now()}_${count}`), { 
                        doc_id: selectedDoc, 
                        dept_id: opd.dept_id, 
                        day: opd.day, 
                        shift: opd.shift, 
                        location_id: opd.location_id 
                    }));
                    
                    tracker[selectedDoc][sIndex] = true; // บันทึกลง Tracker ดักการลงซ้อนทันที
                    shiftCounts[selectedDoc]++;
                    count++;
                }
            }
        });
        
        if (promises.length > 0) {
            await Promise.all(promises);
            window.clearScheduleCache(); 
            if (window.saveLog) window.saveLog("จัดเวรอัตโนมัติ", `ระบบจัดเวรแพทย์ลงกะว่างสำเร็จ ${count} รายการ (จัดทีม 2 คน/กะ) สัปดาห์${window.currentScheduleMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
            alert(`✨ จัดเวรสำเร็จเพิ่มอีก ${count} รายการ!`);
        } else {
            alert("✅ ไม่มีกะว่างที่ระบบสามารถจัดหมอลงเพิ่มได้ (แพทย์ในแผนกอาจไม่พอ หรือทุกกะมีแพทย์ครบแล้ว)");
        }

        window.loadScheduleManager();
        btn.innerHTML = originalText; btn.disabled = false;
    } catch (e) { alert(e.message); }
}

// 🌟 ระบบหน้าสรุปจำนวนเวร (Shift Summary)
window.loadShiftSummaryFilter = async () => {
    const summaryDept = document.getElementById('summaryDept');
    if (!summaryDept) return;
    const { departments } = await getCachedStaticData();
    summaryDept.innerHTML = '<option value="">-- ทุกแผนก --</option>' + departments
        .filter(d => d.is_active !== false)
        .map(d => `<option value="${d.id}">${d.name}</option>`)
        .join('');
}

window.loadShiftSummary = async () => {
    const tbody = document.getElementById('shiftSummaryBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="loader"><i class="fa-solid fa-spinner fa-spin"></i> กำลังประมวลผล...</div></td></tr>`;
    
    try {
        const searchTxt = document.getElementById('summarySearch')?.value.toLowerCase() || "";
        const filterDept = document.getElementById('summaryDept')?.value || "";

        const { doctors, departments } = await getCachedStaticData();
        const [currSnap, nextSnap] = await Promise.all([
            getDocs(collection(db, "doctor_schedules")),
            getDocs(collection(db, "doctor_schedules_next"))
        ]);

        const deptMap = {};
        departments.forEach(d => deptMap[d.id] = d.name);

        const summaryMap = {};
        doctors.forEach(d => {
            summaryMap[d.id] = {
                name: getDoctorName(d),
                nameLower: getDoctorName(d).toLowerCase(),
                mainDeptId: Array.isArray(d.dept_id) ? d.dept_id[0] : d.dept_id,
                deptName: Array.isArray(d.dept_id) ? d.dept_id.map(id => deptMap[id]||id).join(', ') : (deptMap[d.dept_id] || "-"),
                currentCount: 0,
                nextCount: 0
            };
        });

        currSnap.forEach(d => { if (summaryMap[d.data().doc_id]) summaryMap[d.data().doc_id].currentCount++; });
        nextSnap.forEach(d => { if (summaryMap[d.data().doc_id]) summaryMap[d.data().doc_id].nextCount++; });

        let html = "";
        let found = 0;

        // ดึง Map มาเป็น Array เพื่อจัดเรียงตามจำนวนรวม
        const sumArray = Object.values(summaryMap).sort((a, b) => (b.currentCount + b.nextCount) - (a.currentCount + a.nextCount));

        sumArray.forEach(doc => {
            if (searchTxt && !doc.nameLower.includes(searchTxt)) return;
            if (filterDept && doc.mainDeptId !== filterDept) return;
            
            const total = doc.currentCount + doc.nextCount;
            found++;

            html += `<tr>
                <td style="font-weight: bold; color: var(--primary);">${doc.name}</td>
                <td>${doc.deptName}</td>
                <td align="center"><span style="background: #eef2f7; padding: 4px 10px; border-radius: 12px; font-weight: bold;">${doc.currentCount}</span></td>
                <td align="center"><span style="background: #fff8e1; color: #ff9800; padding: 4px 10px; border-radius: 12px; font-weight: bold;">${doc.nextCount}</span></td>
                <td align="center"><span style="background: ${total > 0 ? 'var(--success)' : '#dc3545'}; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold;">${total}</span></td>
            </tr>`;
        });

        tbody.innerHTML = html || `<tr><td colspan="5" align="center" style="padding: 30px;">ไม่พบข้อมูลแพทย์</td></tr>`;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" align="center" style="color:red; padding: 30px;">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`;
    }
}


window.clearAllSchedules = async () => {
    if (!confirm("⚠️ ลบรายชื่อแพทย์ทั้งหมดในตาราง?")) return;
    const { docColl } = getCollections();
    const snap = await getDocs(collection(db, docColl));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, docColl, d.id))));

    window.clearScheduleCache(); 
    if (window.saveLog) window.saveLog("ล้างตารางเวร", `ลบรายชื่อแพทย์ทุกคนออกจากตารางเวร สัปดาห์${window.currentScheduleMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
    window.loadScheduleManager();
}

window.clearAllOpdSchedules = async () => {
    if (!confirm("🚨 ปิดทุกห้องและล้างตารางทั้งหมด?")) return;
    const { opdColl, docColl } = getCollections();
    const [o, s] = await Promise.all([getDocs(collection(db, opdColl)), getDocs(collection(db, docColl))]);
    await Promise.all([...o.docs.map(d => deleteDoc(doc(db, opdColl, d.id))), ...s.docs.map(d => deleteDoc(doc(db, docColl, d.id)))]);

    window.clearScheduleCache(); 
    if (window.saveLog) window.saveLog("ล้างตารางทั้งหมด (ล้างกระดาน)", `ปิดทุกห้องตรวจและลบเวรแพทย์ทั้งหมดใน สัปดาห์${window.currentScheduleMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
    window.loadScheduleManager();
}

window.toggleOpdMaster = async (checkbox, deptId, deptName, day, shift) => {
    const { opdColl, docColl } = getCollections();

    if (checkbox.checked) {
        checkbox.checked = false;
        currentAssignTarget = { deptId, day, shift, deptName, weekMode: window.currentScheduleMode };
        document.getElementById('openShiftModal').style.display = 'flex';

        document.querySelector('#openShiftModal h3').innerHTML = `<i class="fa-solid fa-door-open"></i> เปิดห้องตรวจ`;
        document.querySelector('#openShiftModal .btn-add').innerText = "ยืนยันเปิดกะ";
        document.querySelector('#openShiftModal .btn-add').onclick = confirmOpenShift;
        document.getElementById('openShiftInfo').innerHTML = `<strong>${deptName}</strong> วัน${day} กะ${SHIFTS[shift].label}`;

        const { locations } = await getCachedStaticData();
        document.getElementById('openShiftLocation').innerHTML = '<option value="">-- เลือกห้อง --</option>' + locations.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else {
        if (confirm("ต้องการปิดกะนี้และลบเวรที่เกี่ยวข้องหรือไม่?")) {
            await deleteDoc(doc(db, opdColl, `opd_${deptId}_${day}_${shift}`));
            const q = query(collection(db, docColl), where("dept_id", "==", deptId), where("day", "==", day), where("shift", "==", shift));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, docColl, d.id))));

            window.clearScheduleCache(); 
            if (window.saveLog) window.saveLog("ปิดห้องตรวจ", `ปิดกะตรวจ แผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]} สัปดาห์${window.currentScheduleMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
            window.loadScheduleManager();
        } else checkbox.checked = true;
    }
}

window.confirmOpenShift = async () => {
    const locSelect = document.getElementById('openShiftLocation');
    const locId = locSelect.value;
    if (!locId) return alert("กรุณาเลือกห้อง");
    const locName = locSelect.options[locSelect.selectedIndex].text;
    const { deptId, day, shift, deptName, weekMode } = currentAssignTarget;

    const opdColl = weekMode === 'next' ? "opd_schedules_next" : "opd_schedules";

    await setDoc(doc(db, opdColl, `opd_${deptId}_${day}_${shift}`), { dept_id: deptId, day, shift, location_id: locId, active: true });

    window.clearScheduleCache(); 
    if (window.saveLog) window.saveLog("เปิดห้องตรวจ", `เปิดห้อง ${locName} ในแผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]} สัปดาห์${weekMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
    window.closeOpenShiftModal(); window.loadScheduleManager();
}

window.openChangeRoomModal = async (opdId, deptId, deptName, day, shift, currentLocId) => {
    currentAssignTarget = { opdId, deptId, day, shift, deptName, weekMode: window.currentScheduleMode };
    document.getElementById('openShiftModal').style.display = 'flex';

    document.querySelector('#openShiftModal h3').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> เปลี่ยนห้องตรวจ`;
    document.querySelector('#openShiftModal .btn-add').innerText = "บันทึกการเปลี่ยนห้อง";
    document.querySelector('#openShiftModal .btn-add').onclick = confirmChangeRoom;
    document.getElementById('openShiftInfo').innerHTML = `<strong>${deptName}</strong> วัน${day} กะ${SHIFTS[shift].label}`;

    const { locations } = await getCachedStaticData();
    let options = '<option value="">-- เลือกห้อง --</option>';
    locations.forEach(d => {
        options += `<option value="${d.id}" ${d.id === currentLocId ? 'selected' : ''}>${d.name}</option>`;
    });
    document.getElementById('openShiftLocation').innerHTML = options;
}

window.confirmChangeRoom = async () => {
    const locSelect = document.getElementById('openShiftLocation');
    const locId = locSelect.value;
    if (!locId) return alert("กรุณาเลือกห้อง");

    const locName = locSelect.options[locSelect.selectedIndex].text;
    const { opdId, deptId, day, shift, deptName, weekMode } = currentAssignTarget;

    const opdColl = weekMode === 'next' ? "opd_schedules_next" : "opd_schedules";
    const docColl = weekMode === 'next' ? "doctor_schedules_next" : "doctor_schedules";

    await setDoc(doc(db, opdColl, opdId), { location_id: locId }, { merge: true });

    const q = query(collection(db, docColl), where("dept_id", "==", deptId), where("day", "==", day), where("shift", "==", shift));
    const snap = await getDocs(q);
    const updatePromises = snap.docs.map(d => setDoc(doc(db, docColl, d.id), { location_id: locId }, { merge: true }));
    await Promise.all(updatePromises);

    window.clearScheduleCache(); 
    if (window.saveLog) window.saveLog("เปลี่ยนห้องตรวจ", `เปลี่ยนห้องเป็น ${locName} ในแผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]} สัปดาห์${weekMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');

    window.closeOpenShiftModal();
    window.loadScheduleManager();
}


let currentDocOptions = ''; 

window.updateDocSelectOptions = () => {
    const selects = document.querySelectorAll('select[name="assignDocId"]');
    const selectedIds = Array.from(selects).map(s => s.value).filter(val => val !== "");
    selects.forEach(select => {
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return; 
            opt.disabled = selectedIds.includes(opt.value) && select.value !== opt.value;
        });
    });
}

window.addDocAssignRow = () => {
    const container = document.getElementById('assignDocContainer');
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row'; 
    div.innerHTML = `
        <select name="assignDocId" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;" onchange="updateDocSelectOptions()">
            ${currentDocOptions}
        </select>
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove(); updateDocSelectOptions();">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    container.appendChild(div);
    window.updateDocSelectOptions(); 
}

window.openAssignModal = async (deptId, day, shift, deptName, masterLoc) => {
    currentAssignTarget = { deptId, day, shift, masterLoc, deptName, weekMode: window.currentScheduleMode };
    document.getElementById('assignModal').style.display = 'flex';
    document.getElementById('assignTargetInfo').innerHTML = `<strong>${deptName}</strong> | ${day} | ${SHIFTS[shift].time}`;

    const { doctors, locations } = await getCachedStaticData();

    let docOptions = '<option value="">-- เลือกแพทย์ --</option>';
    doctors.forEach(d => {
        let deptArr = Array.isArray(d.dept_id) ? d.dept_id : (d.dept_id ? [d.dept_id] : []);
        if (deptArr.includes(deptId)) {
            docOptions += `<option value="${d.id}">${getDoctorName(d)}</option>`;
        }
    });

    currentDocOptions = docOptions;

    const container = document.getElementById('assignDocContainer');
    container.innerHTML = '';
    window.addDocAssignRow();
    
    document.getElementById('btnAddDocRow').onclick = () => window.addDocAssignRow();
    document.getElementById('assignLocation').innerHTML = locations.map(d => `<option value="${d.id}" ${d.id === masterLoc ? 'selected' : ''}>${d.name}</option>`).join('');
}

window.confirmAssignment = async () => {
    const selectElements = document.querySelectorAll('select[name="assignDocId"]');
    const selectedDocs = Array.from(selectElements)
        .map(s => ({ id: s.value, name: s.options[s.selectedIndex]?.text }))
        .filter(doc => doc.id !== ""); 

    if (selectedDocs.length === 0) return alert("กรุณาเลือกแพทย์อย่างน้อย 1 ท่าน");

    const uniqueDocIds = new Set(selectedDocs.map(d => d.id));
    if(uniqueDocIds.size !== selectedDocs.length) return alert("กรุณาอย่าเลือกแพทย์ซ้ำกันในรายการ");

    const locId = document.getElementById('assignLocation').value;
    const { day, shift, deptId, deptName, weekMode } = currentAssignTarget;
    const docColl = weekMode === 'next' ? "doctor_schedules_next" : "doctor_schedules";

    for(let docObj of selectedDocs) {
        const snap = await getDocs(query(collection(db, docColl), where("doc_id", "==", docObj.id), where("day", "==", day), where("shift", "==", shift)));
        if (!snap.empty) return alert(`⛔ แพทย์ ${docObj.name} ติดเวรในเวลานี้แล้ว`);
    }

    const promises = selectedDocs.map((docObj, index) => {
        return setDoc(doc(db, docColl, `assign_${Date.now()}_${index}`), { doc_id: docObj.id, dept_id: deptId, day, shift, location_id: locId });
    });

    await Promise.all(promises);

    window.clearScheduleCache(); 
    const allDocNames = selectedDocs.map(d => d.name).join(", ");
    if (window.saveLog) window.saveLog("เพิ่มแพทย์ลงกะ", `จัด ${allDocNames} ลงตรวจที่แผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]} สัปดาห์${weekMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
    
    document.getElementById('assignModal').style.display = 'none'; 
    window.loadScheduleManager();
}

window.removeDoctor = async (id, docName = "แพทย์", deptName = "", day = "") => {
    if (confirm(`ลบ ${docName} ออกจากกะนี้?`)) {
        const docColl = window.currentScheduleMode === 'next' ? "doctor_schedules_next" : "doctor_schedules";
        await deleteDoc(doc(db, docColl, id));
        
        window.clearScheduleCache(); 
        if (window.saveLog) window.saveLog("ลบแพทย์ออกจากกะ", `ลบ ${docName} ออกจากกะตรวจ ${deptName} วัน${day} สัปดาห์${window.currentScheduleMode === 'next' ? 'ถัดไป' : 'ปัจจุบัน'}`, 'schedule');
        window.loadScheduleManager();
    }
}

window.closeAssignModal = () => document.getElementById('assignModal').style.display = 'none';
window.closeOpenShiftModal = () => document.getElementById('openShiftModal').style.display = 'none';