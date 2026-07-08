import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup as fbSignInWithPopup, 
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword, 
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword, 
  signOut as fbSignOut 
} from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwTvmsx4U8KqPwt1oiR7Xvf-vWjQNlQKw",
  authDomain: "multielective.firebaseapp.com",
  projectId: "multielective",
  storageBucket: "multielective.firebasestorage.app",
  messagingSenderId: "744747661278",
  appId: "1:744747661278:web:639b1c215cb65438f2cf4f",
  measurementId: "G-5ZKPBRCLVD"
};

// Check if a real Firebase API Key has been configured
export const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let auth = null;
let googleProvider = null;
let analytics = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    analytics = getAnalytics(app);
  } catch (err) {
    console.error("Firebase SDK failed to initialize:", err);
  }
} else {
  console.log("Firebase is running in Demo Sandbox Mode. Fallback mocks will be used.");
}

// Wrapper for Google Sign-In
export const signInWithGoogle = async () => {
  if (isConfigured && auth) {
    try {
      const result = await fbSignInWithPopup(auth, googleProvider);
      return {
        uid: result.user.uid,
        email: result.user.email,
        username: result.user.displayName || result.user.email.split('@')[0]
      };
    } catch (err) {
      console.error("Firebase Google Sign-In Error:", err);
      throw err;
    }
  } else {
    // Mock simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          uid: "firebase_mock_google_uid_101",
          email: "guest.student@gmail.com",
          username: "guest_student"
        });
      }, 1000);
    });
  }
};

// Wrapper for Email/Password Registration
export const registerWithEmail = async (email, password) => {
  const username = email.split('@')[0];
  if (isConfigured && auth) {
    try {
      const result = await fbCreateUserWithEmailAndPassword(auth, email, password);
      return {
        uid: result.user.uid,
        email: result.user.email,
        username: username
      };
    } catch (err) {
      console.error("Firebase Email Registration Error:", err);
      throw err;
    }
  } else {
    // Mock simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          uid: "firebase_mock_email_uid_102",
          email: email,
          username: username
        });
      }, 800);
    });
  }
};

// Wrapper for Email/Password Login
export const loginWithEmail = async (email, password) => {
  const username = email.split('@')[0];
  if (isConfigured && auth) {
    try {
      const result = await fbSignInWithEmailAndPassword(auth, email, password);
      return {
        uid: result.user.uid,
        email: result.user.email,
        username: username
      };
    } catch (err) {
      console.error("Firebase Email Login Error:", err);
      throw err;
    }
  } else {
    // Mock simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          uid: "firebase_mock_email_uid_102",
          email: email,
          username: username
        });
      }, 800);
    });
  }
};

// Wrapper for Sign Out
export const logoutUser = async () => {
  if (isConfigured && auth) {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error("Firebase Sign-Out Error:", err);
      throw err;
    }
  }
};
