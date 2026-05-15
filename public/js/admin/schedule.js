// ==========================================
// ไฟล์: js/admin/schedule.js
// ==========================================
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-config.js";
import { getDoctorName } from "../utils.js";
import { SHIFTS } from "./config.js";

window.currentScheduleMode = 'grid';
let currentAssignTarget = null;

window.switchScheduleMode = (mode, btn) => {
    window.currentScheduleMode = mode;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.schedule-sub-view').forEach(d => d.classList.remove('active'));
    if (mode === 'grid') {
        document.getElementById('scheduleGridContainer').classList.add('active');
        window.loadScheduleManager();
    } else {
        document.getElementById('scheduleListContainer').classList.add('active');
        window.loadScheduleList();
    }
}

window.loadScheduleFilterOptions = async function () {
    const gridDept = document.getElementById('schedFilterDept'), listDept = document.getElementById('listFilterDept');
    const snap = await getDocs(collection(db, "departments"));
    const opts = '<option value="">-- ทั้งหมด --</option>' + snap.docs.filter(d => d.data().is_active !== false).map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    if (gridDept) gridDept.innerHTML = opts; if (listDept) listDept.innerHTML = opts;
}

// 🌟 1. ย้าย Cache ของข้อมูลพื้นฐานไว้นอกฟังก์ชันเพื่อลดการโหลดซ้ำ (ทำให้ไวขึ้นมาก)
let globalStaticData = null; 
let currentScheduleLoadId = 0;

window.loadScheduleManager = async () => {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;
    
    const targetFilter = document.getElementById('schedFilterDept')?.value || "";
    const loadId = ++currentScheduleLoadId; // สร้าง ID ล่าสุดสำหรับรอบนี้
    
    gridBody.innerHTML = `<tr><td colspan="6" align="center" style="padding:50px;">⏳ กำลังโหลดตาราง...</td></tr>`;
    
    try {
        // 🌟 2. ใช้ Promise.all เพื่อดึงข้อมูลแบบขนาน (Parallel) เพื่อความเร็วสูงสุด
        // แต่เราจะแยกส่วน Static Data (แผนก, หมอ, สถานที่) ออกมาเพื่อทำ Cache ในอนาคตได้
        const fetchTasks = [
            getDocs(collection(db, "opd_schedules")),
            getDocs(collection(db, "doctor_schedules"))
        ];

        // ถ้ายังไม่มีข้อมูลพื้นฐาน ให้ดึงมาพร้อมกันเลย
        if (!globalStaticData) {
            fetchTasks.push(getDocs(collection(db, "departments")));
            fetchTasks.push(getDocs(collection(db, "doctors")));
            fetchTasks.push(getDocs(collection(db, "locations")));
        }

        const results = await Promise.all(fetchTasks);

        // 🌟 3. [CRITICAL CHECK] ทันทีที่โหลดเสร็จ ตรวจสอบก่อนเลยว่า User เปลี่ยนใจหรือยัง?
        // ถ้า loadId ไม่ตรงกับล่าสุด ให้ "ยกเลิก" และ "หยุด" การทำงานของฟังก์ชันนี้ทันที
        if (loadId !== currentScheduleLoadId) return;

        const opdSnap = results[0];
        const docSchSnap = results[1];
        
        if (!globalStaticData) {
            globalStaticData = {
                depts: results[2],
                docs: results[3],
                locs: results[4]
            };
        }

        // 🌟 4. ดำเนินการต่อด้วยข้อมูลที่ดึงมา
        const { depts, docs: docsSnap, locs: locsSnap } = globalStaticData;
        
        let filteredDepts = depts.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.is_active !== false);
        if (targetFilter) filteredDepts = filteredDepts.filter(d => d.id === targetFilter);
        
        const doctorsMap = {}; docsSnap.forEach(d => doctorsMap[d.id] = getDoctorName(d.data()));
        const locationsMap = {}; locsSnap.forEach(d => locationsMap[d.id] = d.data().name);
        
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

        // 🌟 5. [LAST CHECK] ก่อนจะวาด HTML ลงหน้าจอ เช็คอีกครั้งเพื่อความชัวร์
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
            <button onclick="loadScheduleManager()" class="btn-edit" style="margin-top:10px; cursor:pointer;">
                <i class="fa-solid fa-rotate-right"></i> ลองใหม่อีกครั้ง
            </button>
        </td></tr>`;
    }
}

window.loadScheduleList = async () => {
    const tbody = document.getElementById('schedListBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" align="center">กำลังโหลด...</td></tr>`;
    const fDay = document.getElementById('listFilterDay')?.value || "";
    const fDept = document.getElementById('listFilterDept')?.value || "";
    const fDoc = document.getElementById('listSearchDoc')?.value.toLowerCase() || "";
    const [docSchSnap, docSnap, deptSnap] = await Promise.all([getDocs(collection(db, "doctor_schedules")), getDocs(collection(db, "doctors")), getDocs(collection(db, "departments"))]);
    const doctors = {}; docSnap.forEach(d => doctors[d.id] = getDoctorName(d.data()));
    const depts = {}; deptSnap.forEach(d => depts[d.id] = d.data().name);
    let schedules = [];
    docSchSnap.forEach(doc => {
        const d = doc.data(); const name = doctors[d.doc_id] || "Unknown";
        if ((fDay && d.day !== fDay) || (fDept && d.dept_id !== fDept) || (fDoc && !name.toLowerCase().includes(fDoc))) return;
        schedules.push({ id: doc.id, docName: name, deptName: depts[d.dept_id] || "-", day: d.day, shift: SHIFTS[d.shift]?.label || d.shift });
    });
    if (schedules.length === 0) return tbody.innerHTML = `<tr><td colspan="5" align="center">ไม่พบข้อมูล</td></tr>`;
    const dayOrder = { "จันทร์": 1, "อังคาร": 2, "พุธ": 3, "พฤหัส": 4, "ศุกร์": 5 };
    schedules.sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));

    tbody.innerHTML = schedules.map(s => {
        const docNameForLog = s.docName.replace(/'/g, "\\'");
        return `<tr><td>${s.docName}</td><td>${s.deptName}</td><td>${s.day}</td><td>${s.shift}</td><td><button class="btn-del" onclick="removeDoctor('${s.id}', '${docNameForLog}', '${s.deptName}', '${s.day}')">ลบ</button></td></tr>`;
    }).join('');
}

window.autoAssignSchedules = async () => {
    if (!confirm("✨ จัดเวรอัตโนมัติในช่องที่ว่างหรือไม่? (จะไม่ทับแพทย์ที่จัดไว้แล้ว)")) return;
    try {
        const btn = document.querySelector('button[onclick="autoAssignSchedules()"]');
        const originalText = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังคำนวณ...`; btn.disabled = true;

        const [opdSnap, docSchSnap, doctorsSnap] = await Promise.all([getDocs(collection(db, "opd_schedules")), getDocs(collection(db, "doctor_schedules")), getDocs(collection(db, "doctors"))]);

        // 🌟 รองรับแพทย์ 1 คนมีหลายแผนก
        const doctorsByDept = {};
        doctorsSnap.forEach(d => {
            const data = d.data();
            let deptArr = Array.isArray(data.dept_id) ? data.dept_id : (data.dept_id ? [data.dept_id] : []);
            deptArr.forEach(dept => {
                if (!doctorsByDept[dept]) doctorsByDept[dept] = [];
                doctorsByDept[dept].push(d.id);
            });
        });

        const busy = new Set(); const assignedRooms = new Set();
        docSchSnap.forEach(d => {
            const data = d.data();
            assignedRooms.add(`${data.dept_id}_${data.day}_${data.shift}`);
            busy.add(`${data.doc_id}_${data.day}_${data.shift}`);
        });

        const promises = []; let count = 0;
        opdSnap.forEach(d => {
            const opd = d.data(); const key = `${opd.dept_id}_${opd.day}_${opd.shift}`;
            if (!assignedRooms.has(key)) {
                const available = (doctorsByDept[opd.dept_id] || []).sort(() => 0.5 - Math.random());
                const freeDoc = available.find(id => !busy.has(`${id}_${opd.day}_${opd.shift}`));
                if (freeDoc) {
                    promises.push(setDoc(doc(db, "doctor_schedules", `assign_auto_${Date.now()}_${count}`), { doc_id: freeDoc, dept_id: opd.dept_id, day: opd.day, shift: opd.shift, location_id: opd.location_id }));
                    busy.add(`${freeDoc}_${opd.day}_${opd.shift}`); count++;
                }
            }
        });
        if (promises.length > 0) {
            await Promise.all(promises);
            if (window.saveLog) window.saveLog("จัดเวรอัตโนมัติ", `ระบบจัดเวรแพทย์ลงในช่องว่างสำเร็จจำนวน ${count} กะ`, 'schedule');
            alert(`✨ สำเร็จ ${count} กะ!`);
        } else alert("✅ ไม่มีกะว่างที่ระบบสามารถจัดหมอลงเพิ่มได้");

        window.currentScheduleMode === 'grid' ? window.loadScheduleManager() : window.loadScheduleList();
        btn.innerHTML = originalText; btn.disabled = false;
    } catch (e) { alert(e.message); }
}

window.clearAllSchedules = async () => {
    if (!confirm("⚠️ ลบรายชื่อแพทย์ทั้งหมดในตาราง?")) return;
    const snap = await getDocs(collection(db, "doctor_schedules"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "doctor_schedules", d.id))));

    if (window.saveLog) window.saveLog("ล้างตารางเวร", "ลบรายชื่อแพทย์ทุกคนออกจากตารางเวรทั้งหมด", 'schedule');
    window.loadScheduleManager();
}

window.clearAllOpdSchedules = async () => {
    if (!confirm("🚨 ปิดทุกห้องและล้างตารางทั้งหมด?")) return;
    const [o, s] = await Promise.all([getDocs(collection(db, "opd_schedules")), getDocs(collection(db, "doctor_schedules"))]);
    await Promise.all([...o.docs.map(d => deleteDoc(doc(db, "opd_schedules", d.id))), ...s.docs.map(d => deleteDoc(doc(db, "doctor_schedules", d.id)))]);

    if (window.saveLog) window.saveLog("ล้างตารางทั้งหมด (ล้างกระดาน)", "ปิดทุกห้องตรวจและลบเวรแพทย์ทั้งหมดออกจากระบบ", 'schedule');
    window.loadScheduleManager();
}

window.toggleOpdMaster = async (checkbox, deptId, deptName, day, shift) => {
    if (checkbox.checked) {
        checkbox.checked = false;
        currentAssignTarget = { deptId, day, shift, deptName };
        document.getElementById('openShiftModal').style.display = 'flex';

        document.querySelector('#openShiftModal h3').innerHTML = `<i class="fa-solid fa-door-open"></i> เปิดห้องตรวจ`;
        document.querySelector('#openShiftModal .btn-add').innerText = "ยืนยันเปิดกะ";
        document.querySelector('#openShiftModal .btn-add').onclick = confirmOpenShift;
        document.getElementById('openShiftInfo').innerHTML = `<strong>${deptName}</strong> วัน${day} กะ${SHIFTS[shift].label}`;

        const snap = await getDocs(collection(db, "locations"));
        document.getElementById('openShiftLocation').innerHTML = '<option value="">-- เลือกห้อง --</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    } else {
        if (confirm("ต้องการปิดกะนี้และลบเวรที่เกี่ยวข้องหรือไม่?")) {
            await deleteDoc(doc(db, "opd_schedules", `opd_${deptId}_${day}_${shift}`));
            const q = query(collection(db, "doctor_schedules"), where("dept_id", "==", deptId), where("day", "==", day), where("shift", "==", shift));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "doctor_schedules", d.id))));

            if (window.saveLog) window.saveLog("ปิดห้องตรวจ", `ปิดกะตรวจ แผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]}`, 'schedule');
            window.loadScheduleManager();
        } else checkbox.checked = true;
    }
}

window.confirmOpenShift = async () => {
    const locSelect = document.getElementById('openShiftLocation');
    const locId = locSelect.value;
    if (!locId) return alert("กรุณาเลือกห้อง");
    const locName = locSelect.options[locSelect.selectedIndex].text;
    const { deptId, day, shift, deptName } = currentAssignTarget;

    await setDoc(doc(db, "opd_schedules", `opd_${deptId}_${day}_${shift}`), { dept_id: deptId, day, shift, location_id: locId, active: true });

    if (window.saveLog) window.saveLog("เปิดห้องตรวจ", `เปิดห้อง ${locName} ในแผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]}`, 'schedule');
    window.closeOpenShiftModal(); window.loadScheduleManager();
}

window.openChangeRoomModal = async (opdId, deptId, deptName, day, shift, currentLocId) => {
    currentAssignTarget = { opdId, deptId, day, shift, deptName };
    document.getElementById('openShiftModal').style.display = 'flex';

    document.querySelector('#openShiftModal h3').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> เปลี่ยนห้องตรวจ`;
    document.querySelector('#openShiftModal .btn-add').innerText = "บันทึกการเปลี่ยนห้อง";
    document.querySelector('#openShiftModal .btn-add').onclick = confirmChangeRoom;
    document.getElementById('openShiftInfo').innerHTML = `<strong>${deptName}</strong> วัน${day} กะ${SHIFTS[shift].label}`;

    const snap = await getDocs(collection(db, "locations"));
    let options = '<option value="">-- เลือกห้อง --</option>';
    snap.docs.forEach(d => {
        options += `<option value="${d.id}" ${d.id === currentLocId ? 'selected' : ''}>${d.data().name}</option>`;
    });
    document.getElementById('openShiftLocation').innerHTML = options;
}

window.confirmChangeRoom = async () => {
    const locSelect = document.getElementById('openShiftLocation');
    const locId = locSelect.value;
    if (!locId) return alert("กรุณาเลือกห้อง");

    const locName = locSelect.options[locSelect.selectedIndex].text;
    const { opdId, deptId, day, shift, deptName } = currentAssignTarget;

    await setDoc(doc(db, "opd_schedules", opdId), { location_id: locId }, { merge: true });

    const q = query(collection(db, "doctor_schedules"), where("dept_id", "==", deptId), where("day", "==", day), where("shift", "==", shift));
    const snap = await getDocs(q);
    const updatePromises = snap.docs.map(d => setDoc(doc(db, "doctor_schedules", d.id), { location_id: locId }, { merge: true }));
    await Promise.all(updatePromises);

    if (window.saveLog) window.saveLog("เปลี่ยนห้องตรวจ", `เปลี่ยนห้องเป็น ${locName} ในแผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]}`, 'schedule');

    window.closeOpenShiftModal();
    window.loadScheduleManager();
}

// 🌟 อัปเดตตอนแสดงหมอให้กดเลือก (กรองเฉพาะหมอที่มีชื่อในแผนกนั้นๆ)
window.openAssignModal = async (deptId, day, shift, deptName, masterLoc) => {
    currentAssignTarget = { deptId, day, shift, masterLoc, deptName };
    document.getElementById('assignModal').style.display = 'flex';
    document.getElementById('assignTargetInfo').innerHTML = `<strong>${deptName}</strong> | ${day} | ${SHIFTS[shift].time}`;

    const [docSnap, locSnap] = await Promise.all([getDocs(collection(db, "doctors")), getDocs(collection(db, "locations"))]);

    let docOptions = '<option value="">-- เลือกแพทย์ --</option>';
    docSnap.forEach(d => {
        const data = d.data();
        let deptArr = Array.isArray(data.dept_id) ? data.dept_id : (data.dept_id ? [data.dept_id] : []);
        if (deptArr.includes(deptId)) {
            docOptions += `<option value="${d.id}">${getDoctorName(data)}</option>`;
        }
    });

    document.getElementById('assignDocSelect').innerHTML = docOptions;
    document.getElementById('assignLocation').innerHTML = locSnap.docs.map(d => `<option value="${d.id}" ${d.id === masterLoc ? 'selected' : ''}>${d.data().name}</option>`).join('');
}

window.confirmAssignment = async () => {
    const docSelect = document.getElementById('assignDocSelect');
    const docId = docSelect.value;
    const locId = document.getElementById('assignLocation').value;
    if (!docId) return alert("กรุณาเลือกแพทย์");

    const docName = docSelect.options[docSelect.selectedIndex].text;
    const { day, shift, deptId, deptName } = currentAssignTarget;

    const snap = await getDocs(query(collection(db, "doctor_schedules"), where("doc_id", "==", docId), where("day", "==", day), where("shift", "==", shift)));
    if (!snap.empty) return alert("⛔ แพทย์ท่านนี้ติดเวรในเวลานี้แล้ว ไม่สามารถลงเวรซ้ำซ้อนได้");

    await setDoc(doc(db, "doctor_schedules", `assign_${Date.now()}`), { doc_id: docId, dept_id: deptId, day, shift, location_id: locId });

    if (window.saveLog) window.saveLog("เพิ่มแพทย์ลงกะ", `จัด ${docName} ลงตรวจที่แผนก${deptName} วัน${day} กะ${SHIFTS[shift].label.split(' ')[0]}`, 'schedule');
    document.getElementById('assignModal').style.display = 'none'; window.loadScheduleManager();
}

window.removeDoctor = async (id, docName = "แพทย์", deptName = "", day = "") => {
    if (confirm(`ลบ ${docName} ออกจากกะนี้?`)) {
        await deleteDoc(doc(db, "doctor_schedules", id));
        if (window.saveLog) window.saveLog("ลบแพทย์ออกจากกะ", `ลบ ${docName} ออกจากกะตรวจ ${deptName} วัน${day}`, 'schedule');
        window.currentScheduleMode === 'grid' ? window.loadScheduleManager() : window.loadScheduleList();
    }
}

window.closeAssignModal = () => document.getElementById('assignModal').style.display = 'none';
window.closeOpenShiftModal = () => document.getElementById('openShiftModal').style.display = 'none';