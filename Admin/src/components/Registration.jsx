import React, { useState } from 'react';
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";
import "../components/Registration.css";

// Initial form state
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
  photoBase64: "", // <-- Add Base64 field
};

// Success Modal
const SuccessModal = ({ employeeId, photo, onClose }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        {photo && <img src={photo} alt="Employee" style={{ width: 100, marginBottom: 15, borderRadius: "50%" }} />}
        <h3>Registration Successful!</h3>
        <p>Employee has been successfully registered.</p>
        <p>Assigned ID: <strong>{employeeId}</strong></p>
        <button className="close-btn" onClick={onClose}>Close</button>
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

  // Handle photo upload and convert to Base64
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
      setEmployeeData(initialEmployeeData);
      setShowModal(true);

    } catch (e) {
      console.error("Error registering employee: ", e);
      setMessage(`❌ Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setRegisteredId('');
    setMessage('');
  };

  return (
    <>
      <div className="employee-card">
        <h2>Employee Registration</h2>
        <p>Manage employees and assign <strong>System Access Roles</strong> and <strong>Job Positions</strong> here.</p>

        {message && !showModal && <p className="error-message">{message}</p>}

        <form className="employee-form" onSubmit={handleSubmit}>
          <div className="form-columns">
            {/* Column 1 - 6 fields */}
            <div className="form-column">
              <div className="form-field">
                <label htmlFor="firstName">First Name</label>
                <input type="text" id="firstName" name="firstName" placeholder="Enter first name" value={employeeData.firstName} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label htmlFor="middleName">Middle Name</label>
                <input type="text" id="middleName" name="middleName" placeholder="Enter middle name" value={employeeData.middleName} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="lastName">Last Name</label>
                <input type="text" id="lastName" name="lastName" placeholder="Enter last name" value={employeeData.lastName} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="Enter email address" value={employeeData.email} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password" value={employeeData.password} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" value={employeeData.status} onChange={handleSelectChange} required>
                  <option value="">Select Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Column 2 - 6 fields */}
            <div className="form-column">
              <div className="form-field">
                <label htmlFor="systemAccessRole">System Access Role</label>
                <select id="systemAccessRole" name="systemAccessRole" value={employeeData.systemAccessRole} onChange={handleSelectChange} required>
                  <option value="">Select Role</option>
                  <option value="super-admin">Super Admin</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="jobPositionTitle">Job Position</label>
                <select id="jobPositionTitle" name="jobPositionTitle" value={employeeData.jobPositionTitle} onChange={handleSelectChange} required>
                  <option value="">Select Job Position</option>
                  <option value="super-admin">Super Admin</option>
                  <option value="employee">Employee</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="streetName">Street Name</label>
                <input type="text" id="streetName" name="streetName" placeholder="Enter street name" value={employeeData.streetName} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="brgySubd">Barangay / Subdivision</label>
                <input type="text" id="brgySubd" name="brgySubd" placeholder="Enter barangay/subdivision" value={employeeData.brgySubd} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="cityProvince">City / Province</label>
                <input type="text" id="cityProvince" name="cityProvince" placeholder="Enter city/province" value={employeeData.cityProvince} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label htmlFor="zipCode">ZIP Code</label>
                <input type="text" id="zipCode" name="zipCode" placeholder="Enter ZIP code" value={employeeData.zipCode} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Photo Upload - Full Width */}
          <div className="form-field photo-field">
            <label htmlFor="photo">Profile Photo (Optional)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="file" id="photo" accept="image/*" onChange={handlePhotoChange} />
              {employeeData.photoBase64 && (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '10px',
                  border: '2px solid #bae6fd'
                }}>
                  <img 
                    src={employeeData.photoBase64} 
                    alt="Preview" 
                    style={{ 
                      width: '60px', 
                      height: '60px', 
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #0ea5e9'
                    }} 
                  />
                  <span style={{ 
                    fontSize: '14px',
                    color: '#0369a1',
                    fontWeight: '500'
                  }}>
                    ✓ Photo selected
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Register Employee'}
            </button>
          </div>
        </form>
      </div>

      {showModal && <SuccessModal employeeId={registeredId} photo={employeeData.photoBase64} onClose={closeModal} />}
    </>
  );
}
