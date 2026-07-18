// นำเข้า Firebase Modules (V10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// !!!!!!! ใส่คอนฟิก Firebase ของคุณที่นี่ !!!!!!!
const firebaseConfig = {
  apiKey: "AIzaSyDPZnJtY35WtJm0tKU553d6__eeh399uHU",
  authDomain: "elis-system.firebaseapp.com",
  projectId: "elis-system",
  storageBucket: "elis-system.firebasestorage.app",
  messagingSenderId: "327878315493",
  appId: "1:327878315493:web:bb89a044e3ac18f1e7330c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global State
let currentUser = null;
let currentRole = 'borrower'; // 'borrower' or 'staff'

// ================= UI CONTROLS =================
window.toggleLoginForm = (type) => {
    document.getElementById('borrower-login-form').style.display = type === 'borrower' ? 'block' : 'none';
    document.getElementById('staff-login-form').style.display = type === 'staff' ? 'block' : 'none';
};

window.switchPage = (pageId) => {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
};

window.switchStaffTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

window.openModal = (modalId) => document.getElementById(modalId).style.display = 'block';
window.closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';
window.openCreateLoanModal = () => window.openModal('modal-create-loan');

// ================= AUTHENTICATION =================
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        checkUserRole(result.user, 'borrower');
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    }
};

window.loginStaff = async () => {
    const email = document.getElementById('staff-username').value + '@elis.system.local'; // Mocking email for staff
    const pass = document.getElementById('staff-password').value;
    try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        checkUserRole(result.user, 'staff');
    } catch (error) {
        Swal.fire('เข้าสู่ระบบล้มเหลว', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
};

window.logout = async () => {
    await signOut(auth);
    window.switchPage('login-section');
};

const checkUserRole = async (user, attemptedRole) => {
    // Check if account is locked
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().isLocked) {
        Swal.fire('บัญชีถูกระงับ', 'ถูกล็อกโดยผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบ', 'error');
        await signOut(auth);
        return;
    }

    if (attemptedRole === 'staff') {
        currentRole = 'staff';
        document.getElementById('staff-display-name').innerText = `เจ้าหน้าที่: ${user.email.split('@')[0]}`;
        window.switchPage('staff-dashboard');
        loadStaffDashboard();
    } else {
        currentRole = 'borrower';
        document.getElementById('borrower-display-name').innerText = user.displayName || user.email;
        if (!userDoc.exists() || !userDoc.data().profileCompleted) {
            window.switchPage('profile-section');
        } else {
            window.switchPage('borrower-dashboard');
            loadBorrowerDashboard();
        }
    }
};

// ================= BORROWER LOGIC =================
window.saveProfile = async () => {
    const data = {
        name: document.getElementById('profile-name').value,
        phone: document.getElementById('profile-phone').value,
        address: document.getElementById('profile-address').value,
        profileCompleted: true,
        role: 'borrower'
    };
    await setDoc(doc(db, "users", auth.currentUser.uid), data, { merge: true });
    Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อย', 'success');
    window.switchPage('borrower-dashboard');
    loadBorrowerDashboard();
};

window.skipProfile = () => {
    window.switchPage('borrower-dashboard');
    loadBorrowerDashboard();
};

const loadBorrowerDashboard = async () => {
    // ดึงสินเชื่อ
    const loansRef = collection(db, "loans");
    const snapshot = await getDocs(loansRef);
    const container = document.getElementById('available-loans-container');
    container.innerHTML = '';

    const now = new Date();

    snapshot.forEach(docSnap => {
        const loan = docSnap.data();
        const startDate = loan.startDate ? new Date(loan.startDate.toDate()) : now;
        const endDate = loan.endDate ? new Date(loan.endDate.toDate()) : new Date(now.getTime() + 86400000);
        
        let statusHtml = '';
        let isDisabled = false;

        if (now < startDate) {
            statusHtml = `<button class="btn btn-secondary w-100 mt-2" disabled>ยังไม่ถึงระยะเวลา</button>`;
            isDisabled = true;
        } else if (now > endDate) {
            // หายไปใน 24 ชม
            const expireDiff = now.getTime() - endDate.getTime();
            if (expireDiff > (24 * 60 * 60 * 1000)) return; // ข้ามการ render
            
            statusHtml = `<button class="btn btn-secondary w-100 mt-2" disabled>หมดเขตการยื่นสินเชื่อ</button>`;
            isDisabled = true;
        } else {
            statusHtml = `<button class="btn btn-primary w-100 mt-2" onclick="applyLoan('${docSnap.id}')">ยื่นสินเชื่อ</button>`;
        }

        container.innerHTML += `
            <div class="loan-card ${isDisabled ? 'disabled' : ''}" onclick="viewLoanDetails('${docSnap.id}')">
                <h4>${loan.name}</h4>
                <p class="text-muted">รหัส: ${loan.loanId}</p>
                <div class="loan-limit">฿${Number(loan.limit).toLocaleString()}</div>
                <p>สิ้นสุด: ${endDate.toLocaleDateString('th-TH')}</p>
                ${statusHtml}
            </div>
        `;
    });

    loadApplicationHistory();
};

window.applyLoan = async (loanId) => {
    event.stopPropagation();
    // ตรวจสอบข้อมูลส่วนตัว
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().profileCompleted) {
        Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลส่วนตัวก่อนทำการยื่นสินเชื่อ', 'warning').then(() => {
            window.switchPage('profile-section');
        });
        return;
    }

    // Logic ดึง GPS หากสินเชื่อต้องการ (ตามเงื่อนไขที่ 9)
    const loanDoc = await getDoc(doc(db, "loans", loanId));
    if (loanDoc.data().requireGps) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                submitApplication(loanId, { lat: pos.coords.latitude, lng: pos.coords.longitude });
            }, () => {
                Swal.fire('ผิดพลาด', 'ไม่อนุญาตให้เข้าถึงตำแหน่ง จะไม่สามารถยื่นสินเชื่อได้', 'error');
            });
        }
    } else {
        submitApplication(loanId, null);
    }
};

const submitApplication = async (loanId, gpsData) => {
    try {
        await addDoc(collection(db, "applications"), {
            loanId: loanId,
            userId: auth.currentUser.uid,
            status: 1, // 1: ยื่นคำขอ
            gps: gpsData,
            createdAt: serverTimestamp(),
            history: [{ step: 1, note: 'ผู้กู้ยื่นคำขอ', time: new Date() }]
        });
        Swal.fire('สำเร็จ', 'ยื่นคำขอสินเชื่อเรียบร้อยแล้ว', 'success');
        loadApplicationHistory();
    } catch (e) {
        Swal.fire('ข้อผิดพลาด', e.message, 'error');
    }
};

const loadApplicationHistory = async () => {
    const q = query(collection(db, "applications"), where("userId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);
    const container = document.getElementById('application-history-container');
    container.innerHTML = '';

    snapshot.forEach(docSnap => {
        const app = docSnap.data();
        // สร้าง Status Tracker (4 Steps)
        // ใช้ Font Awesome icons: fa-paper-plane, fa-magnifying-glass, fa-file-circle-check, fa-check/fa-xmark
        let step2Class = app.status >= 2 ? 'completed' : (app.status === 2 ? 'active' : '');
        let step3Class = app.status >= 3 ? 'completed' : '';
        let step4Class = app.status === 4 ? 'completed' : (app.status === 5 ? 'error' : '');
        
        let step2Icon = app.status === 2 ? 'fa-solid fa-clock' : 'fa-solid fa-magnifying-glass'; // ไอคอนนาฬิกาตอนกำลังตรวจ

        container.innerHTML += `
            <div class="card mb-3">
                <h4>คำขอสินเชื่อ ID: ${docSnap.id.substring(0,8)}</h4>
                <div class="status-tracker">
                    <div class="status-step completed">
                        <div class="status-icon"><i class="fa-solid fa-paper-plane"></i></div>
                        <div class="status-text">ส่งคำขอ</div>
                    </div>
                    <div class="status-step ${step2Class}">
                        <div class="status-icon"><i class="${step2Icon}"></i></div>
                        <div class="status-text">ตรวจสอบเอกสาร</div>
                    </div>
                    <div class="status-step ${step3Class}">
                        <div class="status-icon"><i class="fa-solid fa-file-circle-check"></i></div>
                        <div class="status-text">ตรวจสอบเสร็จสิ้น</div>
                    </div>
                    <div class="status-step ${step4Class}">
                        <div class="status-icon"><i class="fa-solid ${app.status === 5 ? 'fa-xmark' : 'fa-check'}"></i></div>
                        <div class="status-text">${app.status === 5 ? 'ไม่อนุมัติ' : 'อนุมัติ'}</div>
                    </div>
                </div>
            </div>
        `;
    });
};

// ================= STAFF LOGIC =================
const loadStaffDashboard = async () => {
    // Load Stats & Tables
    const snap = await getDocs(collection(db, "applications"));
    let wait=0, rev=0, apprv=0, rej=0;
    const listBody = document.getElementById('staff-application-list');
    listBody.innerHTML = '';

    snap.forEach(d => {
        const data = d.data();
        if(data.status === 1) wait++;
        if(data.status === 2) rev++;
        if(data.status === 4) apprv++;
        if(data.status === 5) rej++;
        
        listBody.innerHTML += `
            <tr>
                <td>${d.id.substring(0,8)}</td>
                <td>User_${data.userId.substring(0,4)}</td>
                <td>${data.loanId}</td>
                <td>${getStatusBadge(data.status)}</td>
                <td><button class="btn btn-outline btn-sm" onclick="updateAppStatus('${d.id}', ${data.status})">อัปเดตสถานะ</button></td>
            </tr>
        `;
    });
    
    document.getElementById('stat-waiting').innerText = wait;
    document.getElementById('stat-reviewing').innerText = rev;
    document.getElementById('stat-approved').innerText = apprv;
    document.getElementById('stat-rejected').innerText = rej;
    
    loadStaffLoans();
};

const getStatusBadge = (status) => {
    const states = {1: 'รอตรวจสอบ', 2: 'กำลังพิจารณา', 3: 'ตรวจเสร็จสิ้น', 4: 'อนุมัติ', 5: 'ไม่อนุมัติ'};
    return `<span class="btn-sm btn-outline">${states[status] || 'Unknown'}</span>`;
}

window.submitCreateLoan = async () => {
    let loanId = document.getElementById('loan-id').value;
    if (!loanId) loanId = 'LN-' + Date.now().toString().slice(-6); // รันรหัสอัตโนมัติหากเว้นว่าง

    const loanData = {
        name: document.getElementById('loan-name').value,
        loanId: loanId,
        limit: document.getElementById('loan-limit').value,
        details: document.getElementById('loan-details').value,
        conditions: document.getElementById('loan-conditions').value,
        startDate: new Date(document.getElementById('loan-start-date').value),
        endDate: new Date(document.getElementById('loan-end-date').value),
        requireGps: document.getElementById('req-gps').checked,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "loans"), loanData);
        Swal.fire('สำเร็จ', 'สร้างสินเชื่อเรียบร้อย', 'success');
        closeModal('modal-create-loan');
        loadStaffLoans();
    } catch (e) {
        Swal.fire('ข้อผิดพลาด', e.message, 'error');
    }
};

const loadStaffLoans = async () => {
    const snapshot = await getDocs(collection(db, "loans"));
    const container = document.getElementById('staff-loans-list');
    container.innerHTML = '';
    snapshot.forEach(doc => {
        const loan = doc.data();
        container.innerHTML += `
            <div class="loan-card">
                <h4>${loan.name}</h4>
                <p>รหัส: ${loan.loanId}</p>
                <div class="loan-limit">฿${Number(loan.limit).toLocaleString()}</div>
            </div>
        `;
    });
};

window.exportDashboard = (type) => {
    if(type === 'pdf') {
        const element = document.getElementById('tab-overview');
        html2pdf().from(element).save('e-LIS-Report.pdf');
    }
};
// เพิ่มส่วนนี้ในไฟล์ app.js เพื่อดักฟังสถานะล็อกอิน
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ถ้ามี User ล็อกอินอยู่แล้ว ให้ตรวจสอบสิทธิ์แล้วพาไปหน้า Dashboard
        checkUserRole(user, 'borrower'); 
    } else {
        // ถ้าไม่มี User ให้กลับไปหน้า Login
        window.switchPage('login-section');
    }
});
