// ==========================================
// ไฟล์: js/admin/admin.js
// ==========================================
import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-config.js";
import { getDoctorName } from "../utils.js";
import { schemas, menus } from "./config.js";

import "./schedule.js"; 
import "./modals.js"; 
import "./logger.js"; 
import { initAdminPanel } from "./auth.js";

window.currentCollection = 'doctors';
window.currentCategory = 'data';

window.switchCategory = function (cat, el) {
    window.currentCategory = cat;
    document.querySelectorAll('.top-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    window.renderSidebar(); 
    const firstMenu = menus[cat].find(m => !m.type);
    if (firstMenu) window.switchView(firstMenu.id);
}

window.renderSidebar = function () {
    const sb = document.getElementById('sidebarMenu');
    if (!sb) return;
    sb.innerHTML = `<div class="sidebar-header">${window.currentCategory.toUpperCase()}</div>`;
    menus[window.currentCategory].forEach((m) => {
        if (m.type === 'header') sb.innerHTML += `<div class="sidebar-sub-header">${m.title}</div>`;
        else sb.innerHTML += `<div class="menu-item" onclick="switchView('${m.id}', this)"><i class="fa-solid ${m.icon}"></i> ${m.name}</div>`;
    });
}

window.switchView = function (viewId, el) {
    if (el) { 
        document.querySelectorAll('.menu-item').forEach(e => e.classList.remove('active')); 
        el.classList.add('active'); 
    } else {
        window.renderSidebar();
    }
    
    document.querySelectorAll('.section-view').forEach(e => e.classList.remove('active'));
    if (document.getElementById('tableFilterBar')) document.getElementById('tableFilterBar').style.display = 'none';

    if (viewId === 'dashboard') {
        document.getElementById('dashboardView').classList.add('active');
        window.loadDashboard();
    } else if (viewId === 'scheduleManager') {
        document.getElementById('scheduleManagerView').classList.add('active');
        window.loadScheduleFilterOptions();
        if (window.currentScheduleMode === 'grid') window.loadScheduleManager(); else window.loadScheduleList();
    } else if (viewId.startsWith('logs_')) {
        document.getElementById('auditLogsView').classList.add('active');
        const category = viewId.split('_')[1]; 
        if(window.loadLogs) window.loadLogs(category);
    } else if (viewId === 'import') {
        document.getElementById('importView').classList.add('active');
        window.updateInstruction();
    } else {
        document.getElementById('tableView').classList.add('active');
        window.currentCollection = viewId;
        if (window.currentCollection === 'doctors') {
            document.getElementById('tableFilterBar').style.display = 'flex';
            window.loadFilterOptions();
        }
        window.loadTable();
    }
}

window.loadDashboard = async () => {
    try {
        const [docSnap, deptSnap, schSnap, userSnap] = await Promise.all([
            getDocs(collection(db, "doctors")),
            getDocs(collection(db, "departments")),
            getDocs(collection(db, "doctor_schedules")),
            getDocs(collection(db, "users"))
        ]);
        
        document.getElementById('statDoctors').innerText = docSnap.size;
        document.getElementById('statDepts').innerText = deptSnap.docs.filter(d => d.data().is_active !== false).length;
        document.getElementById('statSchedules').innerText = schSnap.size;
        
        const statUsersElement = document.getElementById('statUsers');
        if (statUsersElement) statUsersElement.innerText = userSnap.size;
    } catch(e) {
        console.error("Dashboard Load Error:", e);
    }
}

window.loadTable = async function () {
    const tbody = document.getElementById('tableBody');
    const thead = document.getElementById('tableHead');
    const schema = schemas[window.currentCollection];
    document.getElementById('pageTitle').innerText = `จัดการ${schema.title}`;

    const searchText = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const filterDept = document.getElementById('filterDept')?.value || "";
    const filterSpec = document.getElementById('filterSpec')?.value || "";

    let headerHtml = `<tr><th class="chk-col"><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>`;
    schema.fields.forEach(f => { if (!f.isId) headerHtml += `<th>${f.label}</th>`; });
    headerHtml += `<th>จัดการ</th></tr>`;
    thead.innerHTML = headerHtml;

    try {
        let deptMap = {}, specMap = {};
        if (window.currentCollection === 'doctors') {
            const [dSnap, sSnap] = await Promise.all([getDocs(collection(db, 'departments')), getDocs(collection(db, 'specialties'))]);
            dSnap.forEach(d => deptMap[d.id] = d.data().name);
            sSnap.forEach(d => specMap[d.id] = d.data().name);
        }

        const snap = await getDocs(collection(db, window.currentCollection));
        let html = "";
        
        let tableData = [];
        snap.forEach(d => tableData.push({ id: d.id, ...d.data() }));

        tableData.forEach(data => {
            if (window.currentCollection === 'doctors') {
                const name = getDoctorName(data).toLowerCase();
                const nameEn = (data.name_en || `${data.fname_en||''} ${data.lname_en||''}`).toLowerCase();
                
                // 🌟 ประมวลผล Array ของแผนก
                let deptArr = Array.isArray(data.dept_id) ? data.dept_id : (data.dept_id ? [data.dept_id] : []);
                const deptSearchText = deptArr.map(id => deptMap[id] || "").join(" ").toLowerCase();

                if (searchText && !name.includes(searchText) && !nameEn.includes(searchText) && !deptSearchText.includes(searchText)) return;
                
                if (filterDept) {
                    if (!deptArr.includes(filterDept)) return;
                }
                if (filterSpec && !(Array.isArray(data.specialties) ? data.specialties.includes(filterSpec) : data.specialties === filterSpec)) return;
            }

            if (window.currentCollection === 'users') {
                if (window.currentUser.role === 'Admin' && data.role !== 'Secretary') return; 
            }

            html += `<tr><td class="chk-col"><input type="checkbox" class="row-check" value="${data.id}" onchange="checkBulkBtn()"></td>`;
            schema.fields.forEach(f => {
                if (!f.isId) {
                    let val = data[f.key];
                    if (f.type === 'switch') val = `<label class="switch"><input type="checkbox" ${val ? 'checked' : ''} onchange="toggleItemStatus('${window.currentCollection}','${data.id}','${f.key}',this.checked)"><span class="slider round"></span></label>`;
                    else if (f.type === 'image') val = val ? `<img src="${val}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : '-';
                    else if (f.key === 'dept_id') {
                        let dArr = Array.isArray(val) ? val : (val ? [val] : []);
                        val = dArr.map(id => deptMap[id] || id).join(', ') || '-';
                    }
                    else if (f.key === 'specialties') val = Array.isArray(val) ? val.map(id => specMap[id] || id).join(', ') : specMap[val] || val;
                    else if (f.key === 'password') val = '<span style="color:#aaa; letter-spacing: 2px;">••••••••</span>';
                    else if (f.type === 'date' && val) {
                        const parts = val.split('-');
                        if(parts.length === 3) val = `${parts[2]}/${parts[1]}/${parseInt(parts[0])+543}`;
                    }

                    html += `<td>${val || '-'}</td>`;
                }
            });
            html += `<td><button class="btn-edit" onclick="prepareEdit('${data.id}')">แก้ไข</button> <button class="btn-del" onclick="deleteItem('${data.id}')">ลบ</button></td></tr>`;
        });
        tbody.innerHTML = html || `<tr><td colspan="10" align="center">ไม่พบข้อมูล</td></tr>`;
    } catch (e) { console.error(e); }
}

window.loadFilterOptions = async function() {
    const deptSelect = document.getElementById('filterDept'), specSelect = document.getElementById('filterSpec');
    if (!deptSelect) return;
    const [deptSnap, specSnap] = await Promise.all([getDocs(collection(db, "departments")), getDocs(collection(db, "specialties"))]);
    deptSelect.innerHTML = '<option value="">-- ทุกแผนก --</option>' + deptSnap.docs.filter(d => d.data().is_active !== false).map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
    if (specSelect) specSelect.innerHTML = '<option value="">-- ทุกความเชี่ยวชาญ --</option>' + specSnap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
}

window.applyFilters = () => window.loadTable();

window.deleteItem = async (id) => { 
    if (confirm("ลบข้อมูลนี้?")) { 
        await deleteDoc(doc(db, window.currentCollection, id)); 
        const logCat = window.currentCollection === 'users' ? 'system' : 'data';
        if(window.saveLog) window.saveLog("ลบข้อมูล", `ลบข้อมูล ID: ${id} ออกจากหมวด ${schemas[window.currentCollection].title}`, logCat);
        window.loadTable(); 
    } 
}

window.toggleItemStatus = async (coll, id, field, status) => { 
    await setDoc(doc(db, coll, id), { [field]: status }, { merge: true }); 
    if(window.saveLog) window.saveLog(status ? "เปิดใช้งาน" : "ปิดใช้งาน", `ปรับสถานะของ ID: ${id} ในหมวด ${schemas[coll].title}`);
    window.loadTable(); 
}

window.toggleSelectAll = () => { document.querySelectorAll('.row-check').forEach(cb => cb.checked = document.getElementById('selectAll').checked); window.checkBulkBtn(); };
window.checkBulkBtn = () => {
    const count = document.querySelectorAll('.row-check:checked').length;
    const btn = document.getElementById('btnBulkDel');
    if (btn) { btn.style.display = count > 0 ? 'inline-flex' : 'none'; document.getElementById('selectedCount').innerText = count; }
};

window.deleteBulk = async () => {
    const checkedBoxes = document.querySelectorAll('.row-check:checked');
    if (checkedBoxes.length === 0) return;
    if (confirm(`⚠️ ลบข้อมูลที่เลือกจำนวน ${checkedBoxes.length} รายการ ใช่หรือไม่?\n(ไม่สามารถกู้คืนได้)`)) {
        const btn = document.getElementById('btnBulkDel');
        const originalText = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบ...`; btn.disabled = true;
        try {
            await Promise.all(Array.from(checkedBoxes).map(cb => deleteDoc(doc(db, window.currentCollection, cb.value))));
            if(window.saveLog) window.saveLog("ลบข้อมูลหลายรายการ", `ลบข้อมูลจำนวน ${checkedBoxes.length} รายการ ออกจากหมวด ${schemas[window.currentCollection].title}`);
            alert(`✅ ลบข้อมูลสำเร็จ ${checkedBoxes.length} รายการ!`); window.loadTable(); 
        } catch (error) { alert("❌ เกิดข้อผิดพลาด: " + error.message); }
        btn.innerHTML = originalText; btn.disabled = false;
    }
};

if (typeof initAdminPanel === 'function') {
    initAdminPanel();
}