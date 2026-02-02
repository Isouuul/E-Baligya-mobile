// src/pages/EditProfile.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { updateEmail, updatePassword } from "firebase/auth";
import "../components/EditProfile.css";

export default function EditProfile({ onBack }) {
  const [userData, setUserData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    photoBase64: ""
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uid, setUid] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, "Employees"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        setUserData({
          firstName: data.firstName || "",
          middleName: data.middleName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          password: "",
          photoBase64: data.photoBase64 || "",
        });
        setUid(querySnapshot.docs[0].id);
      }
      setLoading(false);
    };
    fetchUserData();
  }, []);

  const handleChange = (e) => {
    const { placeholder, value } = e.target;
    let key = "";
    switch (placeholder) {
      case "First Name": key = "firstName"; break;
      case "Middle Name": key = "middleName"; break;
      case "Last Name": key = "lastName"; break;
      case "Email Address": key = "email"; break;
      case "Password": key = "password"; break;
      default: return;
    }
    setUserData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setUserData(prev => ({ ...prev, photoBase64: reader.result }));
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    const user = auth.currentUser;
    if (!user || !uid) return;

    try {
      if (user.email !== userData.email) await updateEmail(user, userData.email);
      if (userData.password) await updatePassword(user, userData.password);

      await updateDoc(doc(db, "Employees", uid), {
        firstName: userData.firstName,
        middleName: userData.middleName,
        lastName: userData.lastName,
        email: userData.email,
        photoBase64: userData.photoBase64
      });

      setMessage("✅ Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  if (loading) return <p>Loading profile...</p>;

  return (
    <div className="edit-profile-card">
      <h2>Edit Profile</h2>
      {message && <p className="message">{message}</p>}
      <form className="edit-profile-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input type="text" placeholder="First Name" value={userData.firstName} onChange={handleChange} required />
          <input type="text" placeholder="Middle Name" value={userData.middleName} onChange={handleChange} />
          <input type="text" placeholder="Last Name" value={userData.lastName} onChange={handleChange} required />
        </div>
        <div className="form-row">
          <input type="email" placeholder="Email Address" value={userData.email} onChange={handleChange} required />
          <input type="password" placeholder="Password" value={userData.password} onChange={handleChange} />
        </div>
        <div className="form-row">
          {userData.photoBase64 && <img src={userData.photoBase64} alt="Profile" style={{ width: 80, borderRadius: "50%" }} />}
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>
        <div className="form-row">
          <button type="submit">Update Profile</button>
          {onBack && <button type="button" onClick={onBack} style={{ marginLeft: 10 }}>Back</button>}
        </div>
      </form>
    </div>
  );
}
