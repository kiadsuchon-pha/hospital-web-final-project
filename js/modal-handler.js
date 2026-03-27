// ==========================================
// ไฟล์: modal-handler.js
// หน้าที่: จัดการหน้าต่าง Popup (Modal) สำหรับเพิ่มและแก้ไขข้อมูล
// รวมถึงการสร้างฟอร์มอัตโนมัติตาม Schema และอัปโหลดรูปภาพโปรไฟล์
// ==========================================

import { collection, doc, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { db } from "./firebase-config.js"; 

// เรียกใช้งาน Firebase Storage (สำหรับเก็บรูปภาพ)
const storage = getStorage();

// --- ฟังก์ชันสำหรับ Preview รูปภาพก่อนอัปโหลด ---
window.previewImage = function(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const output = document.getElementById('imagePreview');
        output.src = reader.result;
        output.style.display = 'block';
    };
    if(event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    }
}

// --- ฟังก์ชันช่วยเหลือสำหรับฟอร์มแบบ Dynamic (เพิ่มแถวได้) ---
let specialtiesOptionsCache = ""; 
async function fetchSpecialtiesOptions() {
    if (specialtiesOptionsCache) return specialtiesOptionsCache;
    const specSnap = await getDocs(collection(db, "specialties"));
    let options = `<option value="">-- เลือกความเชี่ยวชาญ --</option>`;
    specSnap.forEach(d => { options += `<option value="${d.id}">${d.data().name}</option>`; });
    specialtiesOptionsCache = options;
    return options;
}

window.addSpecialtyRow = async (containerId, selectedValue = "") => {
    const container = document.getElementById(containerId);
    const options = await fetchSpecialtiesOptions();
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.innerHTML = `
        <select name="specialties" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">${options}</select>
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    if (selectedValue) div.querySelector('select').value = selectedValue;
    container.appendChild(div);
}

window.addEducationRow = (containerId, value = "") => {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.innerHTML = `
        <input type="text" name="edu" value="${value}" placeholder="ระบุวุฒิการศึกษา" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;">
        <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(div);
}

// --- ฟังก์ชันเปิดหน้าต่าง Modal (โหมด 'add' หรือ 'edit') ---
window.openModal = async (mode, data = {}) => {
    // ดึงโครงสร้างตารางมาจากตัวแปรใน admin.js
    const coll = window.getCurrentCollection(); 
    const schema = window.schemas[coll];        
    const form = document.getElementById('formFields');
    
    document.getElementById('modalTitle').innerText = (mode === 'edit' ? 'แก้ไข' : 'เพิ่ม') + schema.title;

    let allFieldsHtml = `<input type="hidden" name="_collection" value="${coll}">`;
    const dynamicFieldsToLoad = [];

    // ดักจับ: กรณีแก้ไขหมอที่มีชื่อรวมมาในก้อนเดียว (name) แต่ไม่มี fname, lname ให้แยกคำอัตโนมัติ
    if (coll === 'doctors' && mode === 'edit' && data.name && !data.fname) {
        const parts = data.name.split(' ');
        if (parts.length >= 3) { data.pname = parts[0]; data.fname = parts[1]; data.lname = parts.slice(2).join(' '); }
        else if (parts.length === 2) { data.fname = parts[0]; data.lname = parts[1]; }
    }

    // สร้าง Input ฟอร์มตามที่กำหนดใน Schema
    for (const f of schema.fields) {
        let val = data[f.key] || "";
        let inputHtml = "";

        if (f.isId) {
            // สร้าง ID อัตโนมัติเมื่อกดเพิ่มข้อมูล
            let autoId = (mode === 'add') ? (coll.substring(0, 3) + '_') + Date.now() : val;
            allFieldsHtml += `<input type="hidden" name="${f.key}" value="${autoId}">`;
            continue;
        }
        else if (f.type === 'image') {
            inputHtml = `
                <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px dashed #ccc; text-align:center;">
                    <img id="imagePreview" src="${val || ''}" style="max-width: 120px; max-height: 120px; margin-bottom: 10px; display: ${val ? 'inline-block' : 'none'}; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);">
                    <input type="file" id="${f.key}_input" accept="image/*" onchange="previewImage(event)" style="display:block; margin: 0 auto;">
                    <input type="hidden" name="${f.key}" value="${val}"> 
                </div>
            `;
        }
        else if (f.type === 'switch') {
            const isChecked = (val === undefined || val === true || val === 'true' || val === "") ? 'checked' : '';
            inputHtml = `<div style="padding-top: 5px;"><label class="switch"><input type="checkbox" name="${f.key}" value="true" ${isChecked}><span class="slider round"></span></label></div>`;
        }
        else if (f.type === 'dynamic_multi_select' && f.key === 'specialties') {
            const containerId = `spec_container_${Date.now()}`;
            inputHtml = `<div id="${containerId}"></div><button type="button" class="btn-add-row" onclick="addSpecialtyRow('${containerId}')">+ เพิ่มความเชี่ยวชาญ</button>`;
            dynamicFieldsToLoad.push(async () => {
                if (Array.isArray(val) && val.length > 0) {
                    for (const v of val) await addSpecialtyRow(containerId, v);
                } else if (data.specialty_id) { await addSpecialtyRow(containerId, data.specialty_id); } 
                else { await addSpecialtyRow(containerId); }
            });
        }
        else if (f.type === 'dynamic_multi_text' && f.key === 'edu') {
            const containerId = `edu_container_${Date.now()}`;
            inputHtml = `<div id="${containerId}"></div><button type="button" class="btn-add-row" onclick="addEducationRow('${containerId}')">+ เพิ่มวุฒิการศึกษา</button>`;
            dynamicFieldsToLoad.push(() => {
                if (Array.isArray(val) && val.length > 0) { val.forEach(v => addEducationRow(containerId, v)); } 
                else { addEducationRow(containerId); }
            });
        }
        else if (f.key === 'dept_id') {
            const selectId = `dept_select_${Date.now()}`;
            inputHtml = `<select id="${selectId}" name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;" ${f.required ? 'required' : ''}><option>Loading...</option></select>`;
            dynamicFieldsToLoad.push(async () => {
                const deptSnap = await getDocs(collection(db, "departments"));
                let options = `<option value="">-- เลือกแผนก --</option>`;
                deptSnap.forEach(d => {
                    if (d.data().is_active !== false || d.id === val) {
                        options += `<option value="${d.id}" ${d.id === val ? 'selected' : ''}>${d.data().name}</option>`;
                    }
                });
                document.getElementById(selectId).innerHTML = options;
            });
        }
        else if (f.key === 'pname') {
            const selectId = `pname_select_${Date.now()}`;
            inputHtml = `<select id="${selectId}" name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;"><option>Loading...</option></select>`;
            dynamicFieldsToLoad.push(async () => {
                const prefixSnap = await getDocs(collection(db, "prefixes"));
                let options = `<option value="">-- เลือก --</option>`;
                if (prefixSnap.empty) ["นพ.", "พญ."].forEach(p => { options += `<option value="${p}">${p}</option>`; });
                else prefixSnap.forEach(d => { const p = d.data().name; options += `<option value="${p}" ${p === val ? 'selected' : ''}>${p}</option>`; });
                document.getElementById(selectId).innerHTML = options;
            });
        }
        else if (f.type === 'select') {
            inputHtml = `<select name="${f.key}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">${f.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
        } else {
            // สำหรับช่อง input ธรรมดา
            inputHtml = `<input type="text" name="${f.key}" value="${val}" placeholder="ระบุ${f.label}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;" ${f.required ? 'required' : ''}>`;
        }

        allFieldsHtml += `<div class="form-group"><label>${f.label} ${f.required ? '<span style="color:red;">*</span>' : ''}</label>${inputHtml}</div>`;
    }

    form.innerHTML = allFieldsHtml;
    // รันฟังก์ชันที่ต้องดึงข้อมูลจาก DB (เช่น Dropdown แผนก, คำนำหน้า)
    for (const fn of dynamicFieldsToLoad) { await fn(); }
    
    document.getElementById('dataModal').style.display = 'flex';
}

window.closeModal = () => {
    document.getElementById('dataModal').style.display = 'none';
}

// ฟังก์ชัน: ดึงข้อมูลเดิมมาเตรียมใส่ฟอร์มก่อนแก้ไข
window.prepareEdit = async (id) => {
    const coll = window.getCurrentCollection();
    const s = await getDoc(doc(db, coll, id));
    if (s.exists()) {
        window.openModal('edit', { ...s.data(), id: s.id });
    }
}

// --- ฟังก์ชันบันทึกข้อมูลเมื่อกด Submit Form ---
document.getElementById('dataForm').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;
    submitBtn.disabled = true;

    const fd = new FormData(e.target);
    const coll = fd.get('_collection');
    const schema = window.schemas[coll];
    const obj = {}; 
    let id = "";

    try {
        for (const f of schema.fields) {
            if (f.isId) {
                id = fd.get(f.key);
            } 
            else if (f.type === 'image') {
                const fileInput = document.getElementById(`${f.key}_input`);
                if (fileInput && fileInput.files.length > 0) {
                    // มีการอัปโหลดรูปใหม่
                    const file = fileInput.files[0];
                    const storageRef = ref(storage, `profiles/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(storageRef);
                    obj[f.key] = downloadURL; 
                } else {
                    // ใช้รูปเดิม
                    obj[f.key] = fd.get(f.key); 
                }
            } 
            else if (f.type === 'switch') {
                obj[f.key] = fd.get(f.key) === 'true';
            } 
            else if (f.key === 'specialties') {
                // รวบรวม Dropdown ความเชี่ยวชาญทั้งหมดที่ถูกเพิ่มไว้เป็น Array
                obj[f.key] = fd.getAll('specialties').filter(v => v !== "");
            } 
            else if (f.key === 'edu') {
                // รวบรวม Input วุฒิการศึกษาทั้งหมดเป็น Array
                obj[f.key] = fd.getAll('edu').filter(v => v.trim() !== "");
            } 
            else {
                obj[f.key] = fd.get(f.key);
            }
        }

        // --- จัดการฟิลด์พิเศษสำหรับตารางแพทย์ ---
        if (coll === 'doctors') {
            const p = obj.pname || ''; 
            const f = obj.fname || ''; 
            const l = obj.lname || '';
            obj.name = `${p} ${f} ${l}`.trim(); // สร้างชื่อเต็มไว้ใช้ค้นหาได้ง่ายขึ้น
            delete obj.specialty_id; // ลบฟิลด์เก่าทิ้ง (ถ้ามีค้างอยู่)
        }

        // บันทึกลง Firestore (merge: true เพื่อไม่ให้ทับข้อมูลเก่าที่ไม่ได้แก้ไข)
        await setDoc(doc(db, coll, id), obj, { merge: true });
        
        window.closeModal();
        window.loadTable();

        // โชว์แจ้งเตือนการบันทึกสำเร็จ
        const toast = document.getElementById('toast');
        if(toast) {
            toast.innerText = "บันทึกข้อมูลสำเร็จ!";
            toast.style.background = "#28a745";
            toast.style.display = "block";
            setTimeout(() => toast.style.display = "none", 3000);
        }

    } catch (error) {
        console.error("Error saving data:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    } finally {
        // คืนค่าปุ่มกลับเป็นแบบเดิม
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}