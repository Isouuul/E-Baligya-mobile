// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyCvl2QP9-7qXE2QPAyuRDo0pe2sViBd07s",
  authDomain: "carl-15a6c.firebaseapp.com", // optional in RN
  projectId: "carl-15a6c",
  storageBucket: "carl-15a6c.appspot.com", // <- corrected
  messagingSenderId: "348281318216",
  appId: "1:348281318216:web:19f6a1733c06ee3db8e17d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
