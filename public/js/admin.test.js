// ==========================================
// ไฟล์: js/admin.test.js
// หน้าที่: ไฟล์ทดสอบระบบ (Unit Tests) ด้วย Mocha & Chai
// ==========================================

import { expect } from "https://cdn.skypack.dev/chai"; 
import { getDoctorName, getDoctorNameEN, filterDoctorsArray } from "./utils.js";

const describe = window.describe;
const it = window.it;

// --- Test Suite 1: การจัดการชื่อแพทย์ (TH / EN) ---
describe('🛠️ ระบบจัดการชื่อแพทย์ (Name Formatting)', () => {
    
    it('ควรแสดงชื่อเต็มภาษาไทยได้อย่างถูกต้อง (TH)', () => {
        const data = { pname: 'นพ.', fname: 'สมชาย', lname: 'ใจดี' };
        expect(getDoctorName(data)).to.equal('นพ. สมชาย ใจดี');
    });

    it('ควรแสดงชื่อเต็มภาษาอังกฤษได้อย่างถูกต้อง (EN)', () => {
        const data = { pname_en: 'Dr.', fname_en: 'Somchai', lname_en: 'Jaidee' };
        expect(getDoctorNameEN(data)).to.equal('Dr. Somchai Jaidee');
    });

    it('ควรจัดการกรณีที่ไม่มีคำนำหน้าชื่อได้โดยไม่เว้นวรรคผิดปกติ', () => {
        const data = { fname: 'สมหญิง', lname: 'จริงใจ' };
        expect(getDoctorName(data)).to.equal('สมหญิง จริงใจ');
    });

    it('ควรคืนค่า "ไม่ระบุชื่อ" ถ้าไม่มีข้อมูลเลย', () => {
        expect(getDoctorName({})).to.equal('ไม่ระบุชื่อ');
        expect(getDoctorName(null)).to.equal('ไม่ระบุชื่อ');
    });
});


// --- Test Suite 2: ระบบการกรองรายชื่อแพทย์ ---
describe('🔍 ระบบการกรองข้อมูลแพทย์ (Data Filtering)', () => {
    
    // ข้อมูลสมมติ (Mock Data) อิงตามโครงสร้างฐานข้อมูลใหม่
    const mockDoctors = [
        { 
            id: 'doc1', pname: 'นพ.', fname: 'เอก', lname: 'เก่งกาจ', 
            pname_en: 'Dr.', fname_en: 'Aek', lname_en: 'Kengkaj',
            dept_id: 'dept_med', specialties: ['spec_cardio', 'spec_gi'] 
        },
        { 
            id: 'doc2', pname: 'พญ.', fname: 'โท', lname: 'ใจดี', 
            pname_en: 'Dr.', fname_en: 'Tho', lname_en: 'Jaidee',
            dept_id: 'dept_surg', specialties: ['spec_neuro'] 
        },
        { 
            id: 'doc3', pname: 'รศ.นพ.', fname: 'ตรี', lname: 'มั่นคง', 
            pname_en: 'Assoc. Prof. Dr.', fname_en: 'Tree', lname_en: 'Mankong',
            dept_id: 'dept_med', specialties: ['spec_cardio'] 
        },
    ];

    // ข้อมูล Map แผนก
    const mockDeptMap = { 'dept_med': 'อายุรกรรม', 'dept_surg': 'ศัลยกรรม' };

    it('ควรค้นหาด้วย "ชื่อภาษาไทย" ได้ถูกต้อง', () => {
        const result = filterDoctorsArray(mockDoctors, 'เอก', '', '', mockDeptMap);
        expect(result).to.have.lengthOf(1);
        expect(result[0].id).to.equal('doc1');
    });

    it('ควรค้นหาด้วย "ชื่อภาษาอังกฤษ" ได้ถูกต้อง', () => {
        const result = filterDoctorsArray(mockDoctors, 'Tree', '', '', mockDeptMap);
        expect(result).to.have.lengthOf(1);
        expect(result[0].id).to.equal('doc3');
    });

    it('ควรค้นหาด้วย "ชื่อแผนก" ได้ถูกต้อง', () => {
        const result = filterDoctorsArray(mockDoctors, 'ศัลยกรรม', '', '', mockDeptMap);
        expect(result).to.have.lengthOf(1);
        expect(result[0].fname).to.equal('โท'); // หมอโท อยู่แผนกศัลยกรรม
    });

    it('ควรกรองด้วยตัวกรอง Dropdown "แผนก" (dept_id) ได้ถูกต้อง', () => {
        const result = filterDoctorsArray(mockDoctors, '', 'dept_med', '', mockDeptMap);
        expect(result).to.have.lengthOf(2); // หมอเอก กับ หมอตรี อยู่ dept_med
    });

    it('ควรกรองด้วยตัวกรอง Dropdown "ความเชี่ยวชาญ" แบบ Array ได้ถูกต้อง', () => {
        // หาหมอที่มีความเชี่ยวชาญ spec_cardio
        const result = filterDoctorsArray(mockDoctors, '', '', 'spec_cardio', mockDeptMap);
        expect(result).to.have.lengthOf(2); // หมอเอก และ หมอตรี
    });

    it('ควรกรองแบบ "รวมเงื่อนไข" (ค้นหาชื่อ + Dropdown แผนก) ได้ถูกต้อง', () => {
        // หาคนที่ชื่อมีคำว่า "เก่งกาจ" และต้องอยู่ใน "dept_med"
        const result = filterDoctorsArray(mockDoctors, 'เก่งกาจ', 'dept_med', '', mockDeptMap);
        expect(result).to.have.lengthOf(1);
        expect(result[0].id).to.equal('doc1');
    });

    it('ควรคืนค่า Array ว่าง (0 รายการ) หากไม่ตรงเงื่อนไขใดเลย', () => {
        // หาคนที่ชื่อ "จัตวา" (ไม่มีในระบบ)
        const result = filterDoctorsArray(mockDoctors, 'จัตวา', '', '', mockDeptMap);
        expect(result).to.have.lengthOf(0);
    });
});