import React, { useState } from 'react';
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";
import "../components/Registration.css";

const initialEmployeeData = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  password: "",
  status: "",
  systemAccessRole: "",
  jobPositionTitle: "",
  streetName: "",
  brgySubd: "",
  cityProvince: "",
  zipCode: "",
  photoBase64: "",
};

const SuccessModal = ({ employeeId, photo, onClose }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="success-icon">✓</div>
        {photo && <img src={photo} alt="Employee" className="modal-avatar" />}
        <h3>Registration Successful</h3>
        <p>The employee profile has been created.</p>
        <div className="id-badge">
          <span>System ID:</span>
          <strong>{employeeId}</strong>
        </div>
        <button className="close-btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
};

export default function Registration() {
  const [employeeData, setEmployeeData] = useState(initialEmployeeData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [registeredId, setRegisteredId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployeeData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e) => {
    setEmployeeData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setEmployeeData(prev => ({ ...prev, photoBase64: reader.result }));
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        employeeData.email,
        employeeData.password
      );
      const uid = userCredential.user.uid;

      await addDoc(collection(db, "Employees"), {
        uid,
        ...employeeData,
        registeredAt: new Date(),
      });

      setRegisteredId(uid);
      setShowModal(true);
      // We don't clear the data immediately so the Modal can show the photo
    } catch (e) {
      console.error("Error registering employee: ", e);
      setMessage(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setRegisteredId('');
    setMessage('');
    setEmployeeData(initialEmployeeData); // Clear data after modal closes
  };

  return (
    <div className="registration-container">
      <div className="employee-card">
        <header className="form-header">
          <h2>Employee Registration</h2>
          <p>Onboard new staff and configure access permissions.</p>
        </header>

        {message && !showModal && <div className="error-banner">{message}</div>}

        <form className="employee-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Section 1: Personal Info */}
            <div className="form-section">
              <h3 className="section-title">Personal Details</h3>
              <div className="field-group">
                <div className="form-field">
                  <label>First Name</label>
                  <input type="text" name="firstName" placeholder="John" value={employeeData.firstName} onChange={handleChange} required />
                </div>
                <div className="form-field">
                  <label>Middle Name</label>
                  <input type="text" name="middleName" placeholder="Quincy" value={employeeData.middleName} onChange={handleChange} />
                </div>
                <div className="form-field">
                  <label>Last Name</label>
                  <input type="text" name="lastName" placeholder="Doe" value={employeeData.lastName} onChange={handleChange} required />
                </div>
              </div>
              
              <div className="field-group">
                <div className="form-field">
                  <label>Email Address</label>
                  <input type="email" name="email" placeholder="email@company.com" value={employeeData.email} onChange={handleChange} required />
                </div>
                <div className="form-field">
                  <label>Password</label>
                  <input type="password" name="password" placeholder="••••••••" value={employeeData.password} onChange={handleChange} required />
                </div>
              </div>
            </div>

            {/* Section 2: Work & Address */}
            <div className="form-section">
              <h3 className="section-title">Work & Location</h3>
              <div className="field-group">
                <div className="form-field">
                  <label>Status</label>
                  <select name="status" value={employeeData.status} onChange={handleSelectChange} required>
                    <option value="">Select...</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>System Access Role</label>
                  <select name="systemAccessRole" value={employeeData.systemAccessRole} onChange={handleSelectChange} required>
                    <option value="">Select...</option>
                    <option value="super-admin">Super Admin</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Job Position Title</label>
                <select name="jobPositionTitle" value={employeeData.jobPositionTitle} onChange={handleSelectChange} required>
                  <option value="">Select...</option>
                  <option value="super-admin">Super Admin</option>
                  <option value="employee">Employee</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                </select>
              </div>

              <div className="address-grid">
                <div className="form-field"><label>Street</label><input type="text" name="streetName" value={employeeData.streetName} onChange={handleChange} /></div>
                <div className="form-field"><label>Brgy/Subd</label><input type="text" name="brgySubd" value={employeeData.brgySubd} onChange={handleChange} /></div>
                <div className="form-field"><label>City/Province</label><input type="text" name="cityProvince" value={employeeData.cityProvince} onChange={handleChange} required /></div>
                <div className="form-field"><label>ZIP</label><input type="text" name="zipCode" value={employeeData.zipCode} onChange={handleChange} /></div>
              </div>
            </div>
          </div>

          <div className="photo-upload-section">
            <label>Profile Image</label>
            <div className={`upload-box ${employeeData.photoBase64 ? 'has-file' : ''}`}>
              <input type="file" id="photo-input" accept="image/*" onChange={handlePhotoChange} />
              <label htmlFor="photo-input" className="upload-label">
                {employeeData.photoBase64 ? (
                  <div className="preview-content">
                    <img src={employeeData.photoBase64} alt="Preview" />
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <div className="upload-icon">+</div>
                    <span>Click to upload photo</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Register Employee'}
            </button>
          </div>
        </form>
      </div>

      {showModal && <SuccessModal employeeId={registeredId} photo={employeeData.photoBase64} onClose={closeModal} />}
    </div>
  );
}