import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { getStoredRememberMe, persistRememberMe } from '../utils/remember-me';

function ToDoSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getStoredRememberMe());
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/to-do');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (newPassword !== verifyPassword) {
      alert('Passwords do not match.');
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, newEmail, newPassword);
      alert('Account created successfully!');
    } catch (error) {
      alert(error.message);
    }
  };

  const [showImages, setShowImages] = useState(false);
  const handleExampleClick = () => {
    setShowImages(!showImages);
  };

  return (
    <div className="signin-page">
      <h2>Sign In</h2>
      <form onSubmit={handleSignIn}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => {
              const nextValue = !rememberMe;
              setRememberMe(nextValue);
              persistRememberMe(nextValue);
            }}
            style={{ marginRight: '0.5em' }}
          />
          Remember Me
        </label>
        <button type="submit">Sign In</button>
      </form>

      <h2 onClick={() => setShowCreate(!showCreate)} style={{ cursor: 'pointer' }}>▶ Create Account</h2>
      {showCreate && (
        <form onSubmit={handleCreateAccount}>
          <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <input type="password" placeholder="Verify Password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} required />
          <button type="submit">Create Account</button>
        </form>
      )}

      <button onClick={handleExampleClick}>See Example</button>
      {showImages && (
        <div className="example-images">
          <p style={{ marginTop: '1em' }}>
            This page is part of a secure reminder and recurring task tracker. Once signed in, users can manage daily tasks, recurring habits, and past-due items — all tied to their private account in Firebase.
          </p>
          <img src="/images/to-do/to-do-1.png" alt="To-Do Example 1" style={{ maxWidth: '100%', marginTop: '1em' }} />
          <img src="/images/to-do/to-do-2.png" alt="To-Do Example 2" style={{ maxWidth: '100%', marginTop: '1em' }} />
        </div>
      )}
    </div>
  );
}

export default ToDoSignIn;
