const fs = require('fs');

const backupFileName = 'my-database-backup.json';
const outputDir = './database-split'; 

console.log('⏳ กำลังเริ่มทำความสะอาดและแยกไฟล์ข้อมูล...');

if (!fs.existsSync(backupFileName)) {
    console.error(`❌ หาไฟล์ ${backupFileName} ไม่เจอครับ`);
    process.exit(1);
}

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

try {
    // 1. อ่านไฟล์เป็นข้อความแบบดิบๆ
    let rawData = fs.readFileSync(backupFileName, 'utf8');
    
    // 2. เวทมนตร์ซ่อม JSON: เติมเครื่องหมาย "" ให้คำว่า export_time ถ้าระบบมันลืมใส่
    rawData = rawData.replace(/export_time\s*:/g, '"export_time":');

    // 3. แปลงกลับเป็น Object
    const db = JSON.parse(rawData);
    const groupedData = {};

    // 4. วนลูปคัดแยกข้อมูลเข้าแต่ละหมวด (แยก audit_logs, doctors, ฯลฯ ออกจากกัน)
    for (const key in db) {
        if (key === 'export_time') continue; // ข้ามข้อมูลเวลาไป ไม่ต้องเอามาสร้างไฟล์

        // แยกชื่อ Collection กับ ID ออกจากกัน (เช่น จาก "audit_logs/123" -> กลายเป็น "audit_logs" และ "123")
        const parts = key.split('/');
        const collectionName = parts[0];
        const docId = parts.slice(1).join('/');

        // ถ้ายังไม่มีกล่องใส่แผนกนี้ ให้สร้างกล่องใหม่
        if (!groupedData[collectionName]) {
            groupedData[collectionName] = {};
        }
        // เอาข้อมูลหยอดลงกล่อง
        groupedData[collectionName][docId] = db[key];
    }

    // 5. สร้างไฟล์แยกตามหมวดหมู่
    for (const collectionName in groupedData) {
        const newFileName = `${outputDir}/${collectionName}.json`;
        fs.writeFileSync(newFileName, JSON.stringify(groupedData[collectionName], null, 2));
        console.log(`✅ สร้างไฟล์สำเร็จ: ${collectionName}.json`);
    }

    console.log(`\n🎉 หั่นไฟล์เสร็จสมบูรณ์! ข้อมูลทั้งหมดอยู่ในโฟลเดอร์ "${outputDir}" ครับ`);

} catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการแยกไฟล์:', error.message);
    console.log('\n💡 ทริคฉุกเฉิน (ถ้ายัง Error):');
    console.log('ให้เปิดไฟล์ my-database-backup.json ใน VS Code แล้วกด Ctrl+F ค้นหาคำว่า export_time');
    console.log('จากนั้นลบบรรทัดที่มีคำนั้นทิ้งไปเลย แล้วกด Save ก่อนรันสคริปต์อีกครั้งครับ');
}