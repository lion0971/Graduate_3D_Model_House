import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjEAOsrsDNzukTyacscnc6Bt71_2HVkXg",
  authDomain: "water-alert-system-79dfa.firebaseapp.com",
  databaseURL: "https://water-alert-system-79dfa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "water-alert-system-79dfa",
};

export const fbApp = initializeApp(firebaseConfig);
export const db = getDatabase(fbApp);
export const auth = getAuth(fbApp);

// 匿名登入完成後 resolve，其他模組 await 後再讀寫資料庫
export const authReadyPromise = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('[Firebase Auth] 匿名登入成功，UID:', user.uid);
      resolve();
    }
  });
  signInAnonymously(auth).catch((err) => {
    console.error('[Firebase Auth] 匿名登入失敗', err);
  });
});