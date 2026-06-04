// ==========================================
// ไฟล์: js/admin/modals.js
// ==========================================
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { db } from "../firebase-config.js";
import { getDoctorName } from "../utils.js";
import { getCachedStaticData } from "../db-service.js";
import { schemas } from "./config.js";

const storage = getStorage();

// --- ดึงข้อมูลความเชี่ยวชาญมาทำ Cache ---
let specialtiesOptionsCache = ""; 
async function fetchSpecialtiesOptions() {
    if (specialtiesOptionsCache) return specialtiesOptionsCache;
    const specSnap = await getDocs(collection(db, "specialties"));
    let options = `<option value="">-- เลือกความเชี่ยวชาญ --</option>`;
    specSnap.forEach(d => { options += `<option value="${d.id}">${d.data().name}</option>`; });
    specialtiesOptionsCache = options;
    return options;
}

// --- สร้าง Select ความเชี่ยวชาญแถวใหม่แบบไดนามิก ---
window.addSpecialtyRow = async (containerId, selectedValue = "") => {
    const container = document.getElementById(containerId);
    if(!container) return;
    const options = await fetchSpecialtiesOptions();
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.innerHTML = `<select name="specialties" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;">${options}</select>
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    if (selectedValue) div.querySelector('select').value = selectedValue;
    container.appendChild(div);
}

// 🌟 เพิ่มฟังก์ชันสำหรับดึงข้อมูลแผนกหลายอัน
// --- ดึงข้อมูลแผนกมาทำ Cache ---
let deptOptionsCache = ""; 
async function fetchDeptOptions() {
    if (deptOptionsCache) return deptOptionsCache;
    // 🚀 ใช้ Cached Data แทน Query ตรง
    const { departments } = await getCachedStaticData();
    let options = `<option value="">-- เลือกแผนก --</option>`;
    departments
        .filter(d => d.is_active !== false)
        .forEach(d => { 
            options += `<option value="${d.id}">${d.name}</option>`; 
        });
    deptOptionsCache = options;
    return options;
}

// --- สร้าง Select แผนกแถวใหม่แบบไดนามิก ---
window.addDeptRow = async (containerId, selectedValue = "") => {
    const container = document.getElementById(containerId);
    if(!container) return;
    const options = await fetchDeptOptions();
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.innerHTML = `<select name="dept_id" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;">${options}</select>
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    if (selectedValue) div.querySelector('select').value = selectedValue;
    container.appendChild(div);
}

// --- สร้าง Input Text แถวใหม่แบบไดนามิก ---
window.addDynamicTextRow = (containerId, fieldName, placeholder, value = "") => {
    const container = document.getElementById(containerId);
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.innerHTML = `<input type="text" name="${fieldName}" value="${value}" placeholder="${placeholder}" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;">
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    container.appendChild(div);
}

// --- สร้างหน้าฟอร์มเพิ่ม/แก้ไขข้อมูลขึ้นมาแบบอัตโนมัติ โดยอ่านจาก config.js ว่าต้องการ input ชนิดใด ---
window.openModal = async (mode, data = {}) => {
    window.currentFormMode = mode; 
    const schema = schemas[window.currentCollection];
    const formFields = document.getElementById('formFields');
    document.getElementById('modalTitle').innerText = (mode === 'edit' ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูล') + schema.title;
    let html = `<input type="hidden" name="_collection" value="${window.currentCollection}">`;
    const dynamicFieldsToLoad = [];

    if (window.currentCollection === 'doctors' && mode === 'edit' && data.name && !data.fname) {
        const parts = data.name.split(' ');
        if (parts.length >= 3) { data.pname = parts[0]; data.fname = parts[1]; data.lname = parts.slice(2).join(' '); }
        else if (parts.length === 2) { data.fname = parts[0]; data.lname = parts[1]; }
    }

    for (const f of schema.fields) {
        let val = data[f.key] || "";
        let input = "";
        if (f.isId) { html += `<input type="hidden" name="${f.key}" value="${mode === 'add' ? (window.currentCollection.substring(0,3)+'_'+Date.now()) : val}">`; continue; }
        
        if (f.type === 'image') {
            input = `<div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px dashed #ccc; text-align:center;">
                        <img id="imagePreview" src="${val || ''}" style="max-width: 120px; max-height: 120px; margin-bottom: 10px; display: ${val ? 'inline-block' : 'none'}; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);">
                        <input type="file" id="${f.key}_input" accept="image/*" onchange="previewImage(event)" style="display:block; margin: 0 auto;">
                        <input type="hidden" name="${f.key}" value="${val}"> 
                    </div>`;
        } else if (f.type === 'switch') {
            const isChecked = (val === undefined || val === true || val === 'true' || val === "") ? 'checked' : '';
            input = `<label class="switch"><input type="checkbox" name="${f.key}" value="true" ${isChecked}> <span class="slider round"></span></label>`;
        } else if (f.type === 'dynamic_multi_select' && f.key === 'specialties') {
            const containerId = `spec_container_${Date.now()}`;
            input = `<div id="${containerId}"></div><button type="button" class="btn-add-row" onclick="addSpecialtyRow('${containerId}')">+ เพิ่มความเชี่ยวชาญ</button>`;
            dynamicFieldsToLoad.push(async () => {
                if (Array.isArray(val) && val.length > 0) { for (const v of val) await addSpecialtyRow(containerId, v); } 
                else if (data.specialty_id) { await addSpecialtyRow(containerId, data.specialty_id); } 
                else { await addSpecialtyRow(containerId); }
            });
        } else if (f.key === 'dept_id') {
            // 🌟 เปลี่ยนแผนกให้เป็นแบบ Dynamic Row
            const containerId = `dept_container_${Date.now()}`;
            input = `<div id="${containerId}"></div><button type="button" class="btn-add-row" onclick="addDeptRow('${containerId}')">+ เพิ่มแผนก</button>`;
            dynamicFieldsToLoad.push(async () => {
                let deptArr = Array.isArray(val) ? val : (val ? [val] : []);
                if (deptArr.length > 0) { for (const v of deptArr) await addDeptRow(containerId, v); } 
                else { await addDeptRow(containerId); }
            });
        } else if (f.type === 'dynamic_multi_text') {
            const containerId = `${f.key}_container_${Date.now()}`;
            input = `<div id="${containerId}"></div><button type="button" class="btn-add-row" onclick="addDynamicTextRow('${containerId}', '${f.key}', 'ระบุ${f.label}')">+ เพิ่ม${f.label}</button>`;
            dynamicFieldsToLoad.push(() => {
                if (Array.isArray(val) && val.length > 0) { val.forEach(v => addDynamicTextRow(containerId, f.key, `ระบุ${f.label}`, v)); } 
                else { addDynamicTextRow(containerId, f.key, `ระบุ${f.label}`); }
            });
        } else if (f.type === 'doctor_select') {
            const selectId = `doc_select_${Date.now()}`;
            input = `<select id="${selectId}" name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;" ${f.required ? 'required' : ''}><option>Loading...</option></select>`;
            dynamicFieldsToLoad.push(async () => {
                // 🚀 ใช้ Cached Data แทน Query ตรง
                const { doctors } = await getCachedStaticData();
                let options = `<option value="">-- เลือกแพทย์ --</option>`;
                doctors.forEach(d => {
                    const name = getDoctorName(d);
                    options += `<option value="${d.id}" ${d.id === val ? 'selected' : ''}>${name}</option>`;
                });
                document.getElementById(selectId).innerHTML = options;
            });
        } else if (f.key === 'pname' || f.key === 'pname_en') {
            const selectId = `${f.key}_select_${Date.now()}`;
            input = `<select id="${selectId}" name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;"><option>Loading...</option></select>`;
            dynamicFieldsToLoad.push(async () => {
                const collName = f.key === 'pname' ? "prefixes_th" : "prefixes_en";
                const prefixSnap = await getDocs(collection(db, collName));
                let options = `<option value="">-- เลือก --</option>`;
                if (prefixSnap.empty) {
                    const defaultOpts = f.key === 'pname' ? ["นพ.", "พญ.", "ทพ.", "ทพญ."] : ["Dr.", "Prof.", "Assoc. Prof.", "Asst. Prof."];
                    defaultOpts.forEach(p => { options += `<option value="${p}" ${p === val ? 'selected' : ''}>${p}</option>`; });
                } else {
                    const uniqueOpts = new Set();
                    prefixSnap.forEach(d => { if (d.data().name) uniqueOpts.add(d.data().name); });
                    uniqueOpts.forEach(p => { options += `<option value="${p}" ${p === val ? 'selected' : ''}>${p}</option>`; });
                }
                document.getElementById(selectId).innerHTML = options;
            });
        } else if (f.type === 'date') {
            input = `<input type="date" name="${f.key}" value="${val}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;" ${f.required ? 'required' : ''}>`;
        } else if (f.type === 'select') {
            let optionsHtml = '';
            if (window.currentCollection === 'users' && f.key === 'role' && window.currentUser.role === 'Admin') {
                optionsHtml = `<option value="Secretary" selected>Secretary</option>`;
            } else {
                optionsHtml = f.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
            }
            input = `<select name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">${optionsHtml}</select>`;
        } else {
            input = `<input type="text" name="${f.key}" value="${val}" placeholder="ระบุ${f.label}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;" ${f.required ? 'required' : ''}>`;
        }
        html += `<div class="form-group"><label>${f.label} ${f.required ? '<span style="color:red;">*</span>' : ''}</label>${input}</div>`;
    }
    formFields.innerHTML = html;
    for (const fn of dynamicFieldsToLoad) { await fn(); }
    document.getElementById('dataModal').style.display = 'flex';
}

// --- พรีวิวรูปก่อนอัปโหลด ---
window.previewImage = function(event) {
    const reader = new FileReader();
    reader.onload = () => { const out = document.getElementById('imagePreview'); out.src = reader.result; out.style.display = 'block'; };
    if(event.target.files[0]) reader.readAsDataURL(event.target.files[0]);
}

// --- ปิดหน้าต่าง Pop-up ---
window.closeModal = () => document.getElementById('dataModal').style.display = 'none';

// --- เตรียมข้อมูลดึงจาก Firestore มาใส่หน้าต่างเพื่อกดแก้ไข ---
window.prepareEdit = async (id) => { const s = await getDoc(doc(db, window.currentCollection, id)); if (s.exists()) window.openModal('edit', { ...s.data(), id: s.id }); }

// --- รวบรวมข้อมูลทั้งหมดที่ผู้ใช้กรอกในฟอร์ม อัปโหลดรูป (ถ้ามี) และบันทึกลง Firestore ---
document.getElementById('dataForm').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText; 
    submitBtn.innerHTML = `กำลังบันทึก...`; 
    submitBtn.disabled = true;

    try {
        const fd = new FormData(e.target);
        const obj = {}; let id = "";
        const schema = schemas[window.currentCollection];

        for (const f of schema.fields) {
            if (f.isId) id = fd.get(f.key);
            else if (f.type === 'image') {
                const fileInput = document.getElementById(`${f.key}_input`);
                if (fileInput && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
                    const sRef = ref(storage, `profiles/${Date.now()}_${safeFileName}`);
                    await uploadBytes(sRef, file);
                    obj[f.key] = await getDownloadURL(sRef);
                } else {
                    obj[f.key] = fd.get(f.key) || "";
                }
            } 
            else if (f.type === 'switch') obj[f.key] = fd.get(f.key) === 'true';
            // 🌟 รองรับ dept_id ให้บันทึกเป็น Array ด้วย
            else if (f.type === 'dynamic_multi_select' || f.key === 'dept_id') obj[f.key] = fd.getAll(f.key).filter(v => v !== "");
            else if (f.type === 'dynamic_multi_text') obj[f.key] = fd.getAll(f.key).filter(v => v.trim() !== "");
            else obj[f.key] = fd.get(f.key);
        }
        
        if (window.currentCollection === 'doctors') {
            obj.name = `${obj.pname||''} ${obj.fname||''} ${obj.lname||''}`.trim();
            obj.name_en = `${obj.pname_en||''} ${obj.fname_en||''} ${obj.lname_en||''}`.trim();
        }
        
        await setDoc(doc(db, window.currentCollection, id), obj, { merge: true });
        
        if (window.saveLog) {
            const actionTitle = window.currentFormMode === 'add' ? "เพิ่มข้อมูล" : "แก้ไขข้อมูล";
            const logCat = window.currentCollection === 'users' ? 'system' : 'data';
            window.saveLog(actionTitle, `${actionTitle} ID: ${id} ลงในตาราง ${schemas[window.currentCollection].title}`, logCat);
        }

        window.closeModal(); 
        window.loadTable();

    } catch (error) {
        console.error("Save Error:", error);
        alert("❌ เกิดข้อผิดพลาดในการบันทึก:\n" + error.message);
    } finally {
        submitBtn.innerHTML = originalText; 
        submitBtn.disabled = false;
    }
}

// --- แสดงคู่มือการวางไฟล์ JSON เพื่อนำเข้าฐานข้อมูล ---
window.updateInstruction = () => {
    const coll = document.getElementById('importCollection')?.value;
    const guide = document.getElementById('formatGuide');
    if (!guide) return;
    if (coll === 'doctors') guide.innerHTML = `<li>id, pname, fname, lname, pname_en, fname_en, lname_en</li><li>dept_id (รหัสแผนก)</li>`;
    else if (coll === 'departments') guide.innerHTML = `<li>id, name</li><li>is_active (true/false)</li>`;
    else if (coll === 'prefixes_th') guide.innerHTML = `<li>id (ปล่อยว่างได้), name (ใส่คำนำหน้าภาษาไทย เช่น นพ., พญ.)</li>`;
    else if (coll === 'prefixes_en') guide.innerHTML = `<li>id (ปล่อยว่างได้), name (ใส่คำนำหน้าภาษาอังกฤษ เช่น Dr., Prof.)</li>`;
    else if (coll === 'users') guide.innerHTML = `<li>id, username, password, display_name</li><li>role (Super Admin, Admin, Secretary), is_active (true/false)</li>`;
    else guide.innerHTML = `<li>id, name</li>`;
}

// --- อ่านเนื้อหาไฟล์ JSON ที่ผู้ใช้เลือกมาแสดงใน Textarea ---
window.handleFile = (input) => {
    const r = new FileReader();
    r.onload = e => document.getElementById('jsonText').value = e.target.result;
    r.readAsText(input.files[0]);
}

// --- นำเข้าข้อมูลทีละก้อนลงฐานข้อมูลจาก JSON ---
window.processImport = async () => {
    const dataText = document.getElementById('jsonText').value;
    if (!dataText) return alert("กรุณาใส่ JSON");
    try {
        const data = JSON.parse(dataText), coll = document.getElementById('importCollection').value;
        const items = Array.isArray(data) ? data : [data];
        const log = document.getElementById('importLog');
        log.style.color = "#0066cc"; log.innerText = `กำลังนำเข้า ${items.length} รายการ...`;
        
        for (let i of items) {
            if (!i.id) i.id = coll.substring(0,3) + '_' + Date.now() + Math.floor(Math.random()*1000);
            await setDoc(doc(db, coll, i.id), i);
        }
        
        log.style.color = "green"; log.innerText = "นำเข้าสำเร็จ!";
        document.getElementById('jsonText').value = "";

        if (window.saveLog) {
            const logCat = coll === 'users' ? 'system' : 'data';
            window.saveLog("นำเข้าข้อมูล (Import)", `นำเข้าข้อมูลแบบกลุ่มจำนวน ${items.length} รายการ ลงในตาราง ${schemas[coll]?.title || coll}`, logCat);
        }

    } catch (e) { 
        document.getElementById('importLog').style.color = "red"; 
        document.getElementById('importLog').innerText = "Error: " + e.message; 
    }
}