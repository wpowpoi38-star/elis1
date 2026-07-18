// นำเข้า Firebase Modules (V10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// !!!!!!! ใส่คอนฟิก Firebase ของคุณที่นี่ (ตรวจสอบให้ถูกต้อง) !!!!!!!
const firebaseConfig = {
  apiKey: "AIzaSyDPZnJtY35WtJm0tKU553d6__eeh399uHU",
  authDomain: "elis-system.firebaseapp.com",
  projectId: "elis-system",
  storageBucket: "elis-system.firebasestorage.app",
  messagingSenderId: "327878315493",
  appId: "1:327878315493:web:bb89a044e3ac18f1e7330c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ================= 1. GLOBAL AUTH LISTENER (หัวใจสำคัญ) =================
// ตัวนี้จะคอยดูสถานะว่า "ล็อกอินอยู่ไหม" ทันทีที่โหลดหน้าเว็บ
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // ถ้ามีผู้ใช้ค้างอยู่ ให้ตรวจสอบสิทธิ์แล้วพาไปหน้าแดชบอร์ด
        console.log("ตรวจพบผู้ใช้ล็อกอินอยู่:", user.email);
        await checkUserRole(user);
    } else {
        // ถ้าไม่มีผู้ใช้ ให้แสดงหน้า Login
        window.switchPage('login-section');
    }
});

// ================= UI CONTROLS =================
window.toggleLoginForm = (type) => {
    document.getElementById('borrower-login-form').style.display = type === 'borrower' ? 'block' : 'none';
    document.getElementById('staff-login-form').style.display = type === 'staff' ? 'block' : 'none';
};

window.switchPage = (pageId) => {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
};

// ================= AUTHENTICATION =================
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // ไม่ต้องเรียก checkUserRole ตรงนี้ เพราะ onAuthStateChanged จะทำงานให้อัตโนมัติ
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    }
};

window.loginStaff = async () => {
    const email = document.getElementById('staff-username').value + '@elis.system.local';
    const pass = document.getElementById('staff-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        Swal.fire('เข้าสู่ระบบล้มเหลว', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
};

window.logout = async () => {
    await signOut(auth);
};

// ================= ตรวจสอบสิทธิ์ (Refined) =================
const checkUserRole = async (user) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // ตรวจสอบสถานะการล็อกบัญชี
    if (userDoc.exists() && userDoc.data().isLocked) {
        Swal.fire('บัญชีถูกระงับ', 'กรุณาติดต่อผู้ดูแลระบบ', 'error');
        await signOut(auth);
        return;
    }

    // แยก Logic ตามประเภทผู้ใช้ (สมมติว่า Staff จะมี email จบด้วย @elis.system.local)
    if (user.email.endsWith('@elis.system.local')) {
        document.getElementById('staff-display-name').innerText = `เจ้าหน้าที่: ${user.email.split('@')[0]}`;
        window.switchPage('staff-dashboard');
        loadStaffDashboard();
    } else {
        // กรณีผู้กู้
        if (!userDoc.exists() || !userDoc.data().profileCompleted) {
            window.switchPage('profile-section');
        } else {
            document.getElementById('borrower-display-name').innerText = user.displayName || user.email;
            window.switchPage('borrower-dashboard');
            loadBorrowerDashboard();
        }
    }
};

// ================= BORROWER & STAFF LOGIC =================
// (นำฟังก์ชัน loadBorrowerDashboard, loadStaffDashboard, ฯลฯ ของเดิมของคุณมาวางต่อท้ายที่นี่ได้เลยครับ)
// ระบบที่ผมปรับปรุงนี้จะทำงานประสานกับฟังก์ชันที่คุณมีอยู่เดิมได้ทันทีครับ
