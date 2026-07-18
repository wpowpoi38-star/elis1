const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ตั้งค่า SMTP ของ Gmail สำหรับส่งอีเมล
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'wpowpoi38@gmail.com',
    pass: 'kfcp fsee nhuj ckvm'
  }
});

// ทริกเกอร์เมื่อมีการเข้าสู่ระบบ (เขียนข้อมูลลง Firestore ว่ามีการล็อกอิน)
exports.onUserLoginAlert = functions.firestore
  .document('login_logs/{logId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const userEmail = data.email;
    const ip = data.ip;
    
    const mailOptions = {
      from: 'e-LIS Security <no-reply@elis.system>',
      to: userEmail,
      subject: 'แจ้งเตือนการเข้าสู่ระบบ e-LIS ใหม่',
      html: `
        <h2 style="color: #0b3d91;">แจ้งเตือนการเข้าสู่ระบบ</h2>
        <p>มีการเข้าสู่ระบบบัญชีของคุณ</p>
        <p><strong>IP Address:</strong> ${ip}</p>
        <p><strong>เวลา:</strong> ${new Date().toLocaleString('th-TH')}</p>
        <hr>
        <p style="color: red;">หากคุณไม่ได้เป็นคนเข้าสู่ระบบ โปรดคลิกปุ่มด้านล่างเพื่อล็อกบัญชีทันที</p>
        <a href="https://YOUR_PROJECT_REGION.cloudfunctions.net/lockAccount?uid=${data.uid}" 
           style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
           ล็อกการใช้งาน (Lock Account)
        </a>
      `
    };

    return transporter.sendMail(mailOptions);
});

// API สำหรับล็อกบัญชีเมื่อกดจากอีเมล
exports.lockAccount = functions.https.onRequest(async (req, res) => {
    const uid = req.query.uid;
    if(!uid) return res.status(400).send("Bad Request");

    try {
        // อัปเดตสถานะใน Firestore
        await admin.firestore().collection('users').doc(uid).set({ isLocked: true }, { merge: true });
        
        // Disable ผ่าน Firebase Auth
        await admin.auth().updateUser(uid, { disabled: true });
        
        res.send("<h3>บัญชีถูกล็อกเรียบร้อยแล้วโดยผู้ดูแลระบบ</h3><p>กรุณาติดต่อผู้ดูแลระบบเพื่อปลดล็อก</p>");
    } catch (error) {
        res.status(500).send("Error locking account");
    }
});
