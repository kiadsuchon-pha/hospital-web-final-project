import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function loadServices() {
    const serviceContainer = document.getElementById('servicesList');
    if (!serviceContainer) return;

    try {
        const [deptSnap, docSnap] = await Promise.all([
            getDocs(collection(db, "departments")),
            getDocs(collection(db, "doctors"))
        ]);

        const docCounts = {};
        docSnap.forEach(doc => {
            const data = doc.data();
            if (data.dept_id) docCounts[data.dept_id] = (docCounts[data.dept_id] || 0) + 1;
        });

        let htmlContent = "";
        deptSnap.forEach(doc => {
            const dept = doc.data();
            
            if (dept.is_active === false) {
                return;
            }

            const count = docCounts[doc.id] || 0;
            const iconClass = dept.icon ? dept.icon : "fa-user-doctor";
            const detailText = dept.detail || 'บริการทางการแพทย์ครบวงจร';

            // เอา style width และ height ออก ให้ CSS และ Swiper จัดการแทน
            htmlContent += `
                <div class="swiper-slide"> 
                    <a href="doctors.html?dept=${dept.name}" class="service-card">
                        <div class="service-icon">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <h3>${dept.name}</h3>
                        <div class="doc-count-badge">
                            <i class="fa-solid fa-user-doctor"></i> แพทย์ ${count} ท่าน
                        </div>
                        <p class="service-detail">
                            ${detailText}
                        </p>
                    </a>
                </div>
            `;
        });

        if (htmlContent) {
            serviceContainer.innerHTML = htmlContent;
        } else {
            serviceContainer.innerHTML = `<div class="swiper-slide" style="width: 100%; text-align: center; color: #888;">ไม่มีบริการที่เปิดใช้งานในขณะนี้</div>`;
        }

        // --- ตั้งค่า Swiper ใหม่ ---
        new Swiper(".mySwiper", {
            loop: true,
            autoplay: {
                delay: 3000,
                disableOnInteraction: false,
            },
            pagination: {
                el: ".swiper-pagination",
                clickable: true,
            },
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
            breakpoints: {
                // มือถือ
                0: { 
                    slidesPerView: 1,
                    spaceBetween: 20,
                }, 
                // แท็บเล็ต
                768: { 
                    slidesPerView: 2, 
                    spaceBetween: 20,
                }, 
                // จอคอม: กำหนดให้แสดง 3 อันพอดี และมีระยะห่างสวยงาม
                1024: { 
                    slidesPerView: 3, 
                    spaceBetween: 30, 
                }, 
            },
        });

    } catch (error) {
        console.error("Service Error:", error);
        serviceContainer.innerHTML = `<div style="text-align:center; color:red;">โหลดข้อมูลไม่สำเร็จ</div>`;
    }
}