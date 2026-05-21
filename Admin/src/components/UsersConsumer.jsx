import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './UsersConsumer.css';

const UsersConsumer = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "Users"), where("role", "==", "Consumer"));
        const snapshot = await getDocs(q);
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    fetchUsers();
  }, []);

  return (
    <div className="glass-container">
      <header className="glass-header">
        <h2 className="title">Registered Consumers</h2>
        <span className="count-badge">{users.length} Active</span>
      </header>

      {loading ? (
        <div className="loader"><span></span></div>
      ) : (
        <div className="glass-list">
          {users.map((user) => (
            <div key={user.uid} className="glass-row">
              <div className="user-profile">
                <img src={user.selfieImage || 'https://ui-avatars.com/api/?name=' + user.firstName} alt="Profile" />
                <div className="user-info">
                  <span className="user-name">{user.firstName} {user.lastName}</span>
                  <span className="user-meta">{user.email}</span>
                </div>
              </div>
              <div className="user-data">
                <span className="phone">{user.phone}</span>
                <span className="date">{user.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersConsumer;