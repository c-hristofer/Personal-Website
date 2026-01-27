import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteUser, getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { UNIT_OPTIONS } from '../../workout/constants';
import {
  deleteWorkoutData,
  exportWorkoutData,
  subscribeToSettings,
  updateSettings,
} from '../../workout/service';
import '../../styles/style.css';

function WorkoutSettings() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      return;
    }
    const unsub = subscribeToSettings(user.uid, (data) => setSettings(data));
    return () => unsub();
  }, [user]);

  const handleUnitChange = async (value) => {
    if (!user) return;
    try {
      await updateSettings(user.uid, { unitSystem: value });
      setStatus('Unit preference saved.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDefaultDayChange = async (value) => {
    if (!user) return;
    try {
      await updateSettings(user.uid, { defaultDayView: value });
      setStatus('Default day preference saved.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/projects/workout');
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      const data = await exportWorkoutData(user.uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `workout-${data.exportedAt || 'data'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Export ready — check your downloads.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirm !== 'DELETE') {
      setError('Type DELETE in all caps to confirm.');
      return;
    }
    setDeleteBusy(true);
    setError('');
    try {
      await deleteWorkoutData(user.uid);
      await deleteUser(user);
      setStatus('Account deleted. Redirecting…');
      navigate('/projects/workout');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please sign in again to delete your account.');
      } else {
        setError(err.message);
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="workout-page">
        <p>Loading settings…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="workout-page">
        <p>You need to sign in to manage settings.</p>
        <Link to="/projects/workout" className="btn">Back to Workout</Link>
      </main>
    );
  }

  return (
    <main className="workout-page">
      <header className="workout-hero">
          <div>
            <h1>Account Settings</h1>
            <p className="help-text">Signed in as {user.email}</p>
          </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate('/projects/workout')}
        >
          Back
        </button>
      </header>
      {status && <p className="status-banner">{status}</p>}
      {error && <p className="form-error">{error}</p>}

      <section className="workout-panel">
        <h2>Units</h2>
        <p className="help-text">Display and record weights using your preferred unit.</p>
        <div className="radio-grid">
          {UNIT_OPTIONS.map((option) => (
            <label key={option.value} className="radio-tile">
              <input
                type="radio"
                name="unit"
                value={option.value}
                checked={(settings?.unitSystem || 'lbs') === option.value}
                onChange={() => handleUnitChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="workout-panel">
        <h2>Default day view</h2>
        <p className="help-text">
          Choose which day the dashboard shows first. “Today” follows America/New_York time.
        </p>
        <div className="radio-grid">
          {['today', 'last'].map((value) => (
            <label key={value} className="radio-tile">
              <input
                type="radio"
                name="default-day"
                value={value}
                checked={(settings?.defaultDayView || 'today') === value}
                onChange={() => handleDefaultDayChange(value)}
              />
              <span>{value === 'today' ? 'Always today' : 'Last opened day'}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="workout-panel">
        <h2>Data</h2>
        <p className="help-text">Export a JSON snapshot or sign out wherever you are.</p>
        <div className="settings-actions">
          <button className="btn" type="button" onClick={handleExport}>
            Export workout data
          </button>
          <button className="btn btn--secondary" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </section>

      <section className="workout-panel workout-panel--danger">
        <h2>Delete account</h2>
        <p className="help-text">
          Deletes workout data and removes your Firebase account. This action cannot be undone.
        </p>
        <label>
          Type DELETE to confirm
          <input
            type="text"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder="DELETE"
          />
        </label>
        <button
          type="button"
          className="btn btn--danger"
          onClick={handleDeleteAccount}
          disabled={deleteBusy}
        >
          {deleteBusy ? 'Deleting…' : 'Delete account'}
        </button>
      </section>
    </main>
  );
}

export default WorkoutSettings;
