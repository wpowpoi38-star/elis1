// นำเข้า Firebase Modules (V10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// คอนฟิก Firebase
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

// ================= 1. GLOBAL AUTH LISTENER (ตัวแก้ลูป) =================
// ตัวนี้จะทำงานทุกครั้งที่หน้าเว็บถูกโหลด
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // ถ้ามี User ล็อกอินอยู่แล้ว ให้ไปที่ฟังก์ชันตรวจสอบสิทธิ์
        await checkUserRole(user);
    } else {
        // ถ้าไม่มี User ให้แสดงหน้า Login
        window.switchPage('login-section');
    }
});

// ================= 2. UI CONTROLS =================
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

// ================= 3. AUTHENTICATION =================
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // หลังจาก Login สำเร็จ onAuthStateChanged จะทำงานต่อเอง
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    }
};

window.loginStaff = async () => {
    const username = document.getElementById('staff-username').value;
    const pass = document.getElementById('staff-password').value;
    const email = username + '@elis.system.local'; 
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        Swal.fire('เข้าสู่ระบบล้มเหลว', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
};

window.logout = async () => {
    await signOut(auth);
    window.location.reload(); // รีโหลดหน้าเพื่อล้าง State ทั้งหมด
};

// ================= 4. ROLE LOGIC (หัวใจของระบบ) =================
const checkUserRole = async (user) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // ตรวจสอบว่าบัญชีถูกล็อกหรือไม่
    if (userDoc.exists() && userDoc.data().isLocked) {
        Swal.fire('บัญชีถูกระงับ', 'กรุณาติดต่อผู้ดูแลระบบ', 'error');
        await signOut(auth);
        return;
    }

    // แยกประเภท User
    if (user.email.endsWith('@elis.system.local')) {
        document.getElementById('staff-display-name').innerText = `เจ้าหน้าที่: ${user.email.split('@')[0]}`;
        window.switchPage('staff-dashboard');
        loadStaffDashboard();
    } else {
        // ถ้าเป็นผู้กู้
        if (!userDoc.exists() || !userDoc.data().profileCompleted) {
            window.switchPage('profile-section');
        } else {
            document.getElementById('borrower-display-name').innerText = user.displayName || user.email;
            window.switchPage('borrower-dashboard');
            loadBorrowerDashboard();
        }
    }
};

// ================= 5. BORROWER LOGIC =================
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
    const loansRef = collection(db, "loans");
    const snapshot = await getDocs(loansRef);
    const container = document.getElementById('available-loans-container');
    if (!container) return;
    container.innerHTML = '';

    const now = new Date();
    snapshot.forEach(docSnap => {
        const loan = docSnap.data();
        const endDate = loan.endDate ? new Date(loan.endDate.toDate()) : new Date();
        
        container.innerHTML += `
            <div class="loan-card">
                <h4>${loan.name}</h4>
                <p>รหัส: ${loan.loanId}</p>
                <div class="loan-limit">฿${Number(loan.limit).toLocaleString()}</div>
                <button class="btn btn-primary w-100" onclick="applyLoan('${docSnap.id}')">ยื่นสินเชื่อ</button>
            </div>
        `;
    });
};

window.applyLoan = async (loanId) => {
    try {
        await addDoc(collection(db, "applications"), {
            loanId: loanId,
            userId: auth.currentUser.uid,
            status: 1,
            createdAt: serverTimestamp()
        });
        Swal.fire('สำเร็จ', 'ยื่นคำขอสินเชื่อเรียบร้อย', 'success');
    } catch (e) {
        Swal.fire('ข้อผิดพลาด', e.message, 'error');
    }
};

// ================= 6. STAFF LOGIC =================
const loadStaffDashboard = async () => {
    const snap = await getDocs(collection(db, "applications"));
    const listBody = document.getElementById('staff-application-list');
    if (!listBody) return;
    listBody.innerHTML = '';

    snap.forEach(d => {
        const data = d.data();
        listBody.innerHTML += `
            <tr>
                <td>${d.id.substring(0,8)}</td>
                <td>User_${data.userId.substring(0,4)}</td>
                <td>${data.loanId}</td>
                <td><button class="btn btn-outline btn-sm">สถานะ: ${data.status}</button></td>
            </tr>
        `;
    });
    loadStaffLoans();
};

window.submitCreateLoan = async () => {
    const loanData = {
        name: document.getElementById('loan-name').value,
        loanId: document.getElementById('loan-id').value || 'LN-' + Date.now().toString().slice(-6),
        limit: document.getElementById('loan-limit').value,
        details: document.getElementById('loan-details').value,
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
    if (!container) return;
    container.innerHTML = '';
    snapshot.forEach(doc => {
        const loan = doc.data();
        container.innerHTML += `<div class="loan-card"><h4>${loan.name}</h4><p>รหัส: ${loan.loanId}</p></div>`;
    });
};
