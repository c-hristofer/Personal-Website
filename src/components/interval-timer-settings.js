import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const getIntervalTimerSettings = () => {
  if (typeof window === 'undefined') {
    return { soundEnabled: true, viewPreference: 'split' };
  }
  try {
    const raw = window.localStorage.getItem('intervalTimerSettings');
    const parsed = raw ? JSON.parse(raw) : {};
    const viewPreference = ['split', 'focus', 'last'].includes(parsed.viewPreference)
      ? parsed.viewPreference
      : 'split';
    return {
      soundEnabled: parsed.soundEnabled !== false,
      viewPreference,
    };
  } catch (error) {
    return { soundEnabled: true, viewPreference: 'split' };
  }
};

function IntervalTimerSettings() {
  const navigate = useNavigate();
  const auth = getAuth();
  const userEmail = auth.currentUser?.email || 'your account';
  const [settings, setSettings] = useState(getIntervalTimerSettings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('intervalTimerSettings', JSON.stringify(settings));
    window.dispatchEvent(new Event('intervalTimerSettingsUpdated'));
  }, [settings]);

  return (
    <main className="workout-page">
      <header className="workout-hero workout-hero--settings">
        <div className="workout-hero__identity">
          <div>
            <h1>Interval Timer Settings</h1>
            <p className="help-text">Signed in as {userEmail}</p>
          </div>
        </div>
        <button
          type="button"
          className="workout-hero__back"
          onClick={() => navigate('/interval-timer')}
          aria-label="Back"
        >
          <img src="/icons/chevron-left.svg" alt="" aria-hidden="true" />
        </button>
      </header>

      <section className="workout-panel">
        <h2>Preferences</h2>
        <div className="field-row">
          <label className={`toggle ${settings.soundEnabled ? 'is-active' : ''}`}>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => setSettings((prev) => ({ ...prev, soundEnabled: event.target.checked }))}
            />
            <span className="toggle__track">
              <span className="toggle__thumb" />
            </span>
            <span className="toggle__label">Audio cues</span>
          </label>
        </div>
        <fieldset className="interval-settings__group">
          <legend>Default view</legend>
          <p className="help-text">Choose how the timer opens when you start a session.</p>
          <div className="radio-grid interval-view-grid">
            <label
              className={`radio-tile interval-view-tile${settings.viewPreference === 'split' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="interval-view-preference"
                value="split"
                checked={settings.viewPreference === 'split'}
                onChange={(event) => setSettings((prev) => ({ ...prev, viewPreference: event.target.value }))}
              />
              <span className="interval-view-tile__copy">
                <strong>Collapsed</strong>
                <span className="help-text">Plan and timer together.</span>
              </span>
            </label>
            <label
              className={`radio-tile interval-view-tile${settings.viewPreference === 'focus' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="interval-view-preference"
                value="focus"
                checked={settings.viewPreference === 'focus'}
                onChange={(event) => setSettings((prev) => ({ ...prev, viewPreference: event.target.value }))}
              />
              <span className="interval-view-tile__copy">
                <strong>Expanded</strong>
                <span className="help-text">Timer only, full focus.</span>
              </span>
            </label>
            <label
              className={`radio-tile interval-view-tile${settings.viewPreference === 'last' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="interval-view-preference"
                value="last"
                checked={settings.viewPreference === 'last'}
                onChange={(event) => setSettings((prev) => ({ ...prev, viewPreference: event.target.value }))}
              />
              <span className="interval-view-tile__copy">
                <strong>Last used</strong>
                <span className="help-text">Opens where you left it.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </section>

      <section className="workout-panel">
        <h2>Account</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            await signOut(auth);
            navigate('/interval-timer');
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

export default IntervalTimerSettings;
