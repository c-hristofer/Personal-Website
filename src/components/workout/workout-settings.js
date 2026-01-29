import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteUser, getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { UNIT_OPTIONS } from '../../workout/constants';
import { getWeekInfo } from '../../workout/date';
import {
  deleteWorkoutData,
  exportWorkoutData,
  subscribeToSettings,
  updateSettings,
} from '../../workout/service';
import { normalizeDeloadConfig } from '../../workout/utils';
import '../../styles/style.css';

function WorkoutSettings() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deloadStatus, setDeloadStatus] = useState('');
  const [deloadError, setDeloadError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deloadDraft, setDeloadDraft] = useState(null);
  const deloadSaveTimer = useRef(null);
  const deloadSyncRef = useRef(false);

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
      setDeloadDraft(null);
      return;
    }
    const unsub = subscribeToSettings(user.uid, (data) => setSettings(data));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!settings) {
      setDeloadDraft(null);
      return;
    }
    const normalized = normalizeDeloadConfig(settings);
    deloadSyncRef.current = true;
    setDeloadDraft({
      deloadEnabled: normalized.deloadEnabled,
      deloadPercent: settings?.deloadPercent ?? normalized.deloadPercent,
      deloadFrequencyWeeks: settings?.deloadFrequencyWeeks ?? normalized.deloadFrequencyWeeks,
      deloadAnchorWeekId: settings?.deloadAnchorWeekId || normalized.deloadAnchorWeekId || null,
    });
  }, [settings]);

  useEffect(() => {
    return () => {
      if (deloadSaveTimer.current) {
        clearTimeout(deloadSaveTimer.current);
      }
    };
  }, []);

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

  const handleDeloadChange = (field, value) => {
    setDeloadDraft((prev) => {
      if (!prev) return prev;
      let nextValue = value;
      if (field === 'deloadPercent' || field === 'deloadFrequencyWeeks') {
        nextValue = value === '' ? '' : Number(value);
      }
      return {
        ...prev,
        [field]: nextValue,
      };
    });
    setDeloadStatus('');
    setDeloadError('');
  };

  const handleSaveDeload = async (draft) => {
    if (!user || !deloadDraft) return;
    setDeloadError('');
    setDeloadStatus('');
    if (draft.deloadEnabled) {
      if (draft.deloadFrequencyWeeks === '' || draft.deloadFrequencyWeeks === null) {
        setDeloadError('Deload frequency is required.');
        return;
      }
      if (Number(draft.deloadFrequencyWeeks) < 2) {
        setDeloadError('Deload frequency must be at least 2 weeks.');
        return;
      }
    }
    const normalized = normalizeDeloadConfig(draft);
    let nextAnchor = draft.deloadAnchorWeekId || settings?.deloadAnchorWeekId || null;
    if (normalized.deloadEnabled) {
      if (!nextAnchor) {
        nextAnchor = getWeekInfo().weekId;
      }
    } else {
      nextAnchor = null;
    }
    try {
      await updateSettings(user.uid, {
        deloadEnabled: normalized.deloadEnabled,
        deloadPercent: normalized.deloadPercent,
        deloadFrequencyWeeks: normalized.deloadFrequencyWeeks,
        deloadAnchorWeekId: normalized.deloadEnabled ? nextAnchor : null,
      });
      setDeloadStatus('Deload settings saved.');
    } catch (err) {
      setDeloadError(err.message);
    }
  };

  useEffect(() => {
    if (!user || !deloadDraft) return;
    if (deloadSyncRef.current) {
      deloadSyncRef.current = false;
      return;
    }
    if (deloadDraft.deloadFrequencyWeeks === '' || deloadDraft.deloadFrequencyWeeks === null) {
      return;
    }
    const currentNormalized = normalizeDeloadConfig(settings || {});
    const currentAnchor = settings?.deloadAnchorWeekId || currentNormalized.deloadAnchorWeekId || null;
    const draftNormalized = normalizeDeloadConfig(deloadDraft);
    if (
      currentNormalized.deloadEnabled === draftNormalized.deloadEnabled
      && currentNormalized.deloadPercent === draftNormalized.deloadPercent
      && currentNormalized.deloadFrequencyWeeks === draftNormalized.deloadFrequencyWeeks
      && currentAnchor === (deloadDraft.deloadAnchorWeekId || null)
    ) {
      return;
    }
    if (deloadSaveTimer.current) {
      clearTimeout(deloadSaveTimer.current);
    }
    deloadSaveTimer.current = setTimeout(() => {
      handleSaveDeload(deloadDraft);
    }, 600);
    return () => {
      if (deloadSaveTimer.current) {
        clearTimeout(deloadSaveTimer.current);
      }
    };
  }, [deloadDraft, user]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/workout');
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
      navigate('/workout');
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
        <Link to="/workout" className="btn">Back to Workout</Link>
      </main>
    );
  }

  return (
    <main className="workout-page">
      <header className="workout-hero workout-hero--settings">
        <div>
          <h1>Account Settings</h1>
          <p className="help-text">Signed in as {user.email}</p>
        </div>
        <button
          type="button"
          className="workout-hero__back"
          onClick={() => navigate('/workout')}
          aria-label="Back"
        >
          <img src="/icons/chevron-left.svg" alt="" aria-hidden="true" />
        </button>
        <button
          className="btn btn--ghost workout-hero__signout"
          type="button"
          onClick={handleSignOut}
        >
          Sign out
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
        <h2>Deload weeks</h2>
        <p className="help-text">Control how often deload weeks occur and how much weights drop.</p>
        {deloadDraft && (
          <>
            <div className="deload-config">
              <div className="deload-config__head">
                <h3>Deload cadence</h3>
                <span className="tag">Exercises only</span>
              </div>
              <label className="deload-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(deloadDraft.deloadEnabled)}
                  onChange={(event) => handleDeloadChange('deloadEnabled', event.target.checked)}
                />
                <span>Enable deload weeks</span>
              </label>
              <div className="deload-config__grid">
                <label>
                  Deload percentage
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={deloadDraft.deloadPercent === '' ? '' : deloadDraft.deloadPercent}
                    onChange={(event) => handleDeloadChange('deloadPercent', event.target.value)}
                    disabled={!deloadDraft.deloadEnabled}
                  />
                  <span className="help-text">Lower weights by this amount.</span>
                </label>
                <label>
                  Frequency (weeks)
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={deloadDraft.deloadFrequencyWeeks === '' ? '' : deloadDraft.deloadFrequencyWeeks}
                    onChange={(event) => handleDeloadChange('deloadFrequencyWeeks', event.target.value)}
                    disabled={!deloadDraft.deloadEnabled}
                  />
                  <span className="help-text">Every Nth week will deload.</span>
                </label>
              </div>
              <p className="help-text">
                Applies to exercise weights only. Trackers and cardio stay unchanged.
              </p>
              {deloadStatus && <p className="status-banner">{deloadStatus}</p>}
              {deloadError && <p className="form-error">{deloadError}</p>}
            </div>
          </>
        )}
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
