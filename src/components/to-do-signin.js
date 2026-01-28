import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStoredRememberMe, persistRememberMe } from '../utils/remember-me';
import { applyPersistencePreference } from '../utils/auth-persistence';

function ToDoSignIn() {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getStoredRememberMe());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showExample, setShowExample] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate('/to-do');
      }
    });
    return () => unsubscribe();
  }, [auth, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const applied = await applyPersistencePreference(auth, rememberMe ? 'local' : 'session');
      if (applied !== 'local' && rememberMe) {
        setRememberMe(false);
        persistRememberMe(false);
      }
      if (mode === 'sign-in') {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/to-do');
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Account created successfully!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [showImages, setShowImages] = useState(false);
  const handleExampleClick = () => {
    setShowImages(!showImages);
  };

  return (
    <div className="todo-auth">
      <section className="todo-auth__intro">
        <h1>To-Do Sign in</h1>
        <p>Securely manage daily reminders, recurring habits, and catch up on past-due tasks from any device.</p>
      </section>

      <section className="todo-auth__panel">
        <div className="todo-auth__tabs">
          <button
            type="button"
            className={mode === 'sign-in' ? 'is-active' : ''}
            onClick={() => setMode('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'create' ? 'is-active' : ''}
            onClick={() => setMode('create')}
          >
            Create account
          </button>
        </div>

        <form className="todo-auth__form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
          </label>
          {mode === 'create' && (
            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
          )}
          <label className="remember-toggle" data-active={rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              className="remember-toggle__input"
              onChange={() => {
                const nextValue = !rememberMe;
                setRememberMe(nextValue);
                persistRememberMe(nextValue);
              }}
            />
            <span className="remember-toggle__track" aria-hidden="true">
              <span className="remember-toggle__thumb" />
            </span>
            <span className="remember-toggle__copy">
              <span className="remember-toggle__title">Remember me</span>
              <span className="remember-toggle__hint">Keep yourself signed in on this device.</span>
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>

      <button onClick={handleExampleClick} className="todo-auth__example-btn">See Example</button>
      {showImages && (
        <div className="example-images">
          <p style={{ marginTop: '1em' }}>
            This page is part of a secure reminder and recurring task tracker. Once signed in, users can manage daily tasks, recurring habits, and past-due items — all tied to their private account in Firebase.
          </p>
          <img src="./images/to-do/to-do-1.png" alt="To-Do Example 1" style={{ maxWidth: '100%', marginTop: '1em' }} />
          <img src="./images/to-do/to-do-2.png" alt="To-Do Example 2" style={{ maxWidth: '100%', marginTop: '1em' }} />
        </div>
      )}
    </div>
  );
}

export default ToDoSignIn;
