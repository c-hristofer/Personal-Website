import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { applyPersistencePreference } from '../utils/auth-persistence';
import { db } from '../firebase';
import { getStoredRememberMe, persistRememberMe } from '../utils/remember-me';

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSeconds = (value) => {
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatDurationLabel = (value) => {
  const total = Math.max(0, Number(value) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const getPlanTotalSeconds = (plan) => {
  if (!plan || !Array.isArray(plan.segments)) return 0;
  return plan.segments.reduce((total, segment) => {
    const minutes = parseNumber(segment.minutes);
    const seconds = parseNumber(segment.seconds);
    const durationSeconds = Math.max(0, minutes * 60 + seconds);
    const repeat = Math.max(1, Number(segment.repeat) || 1);
    return total + durationSeconds * repeat;
  }, 0);
};

function IntervalTimerProject() {
  const auth = getAuth();
  const [authState, setAuthState] = useState({ user: null, loading: true });
  const defaultPlans = useMemo(() => ([
    { id: 'plan-1', title: 'Interval Timer', segments: [{ label: 'Work', minutes: 0, seconds: 30, repeat: 1 }] },
  ]), []);
  const [plans, setPlans] = useState(defaultPlans);
  const [favoritePlanId, setFavoritePlanId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('plan-1');
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [timerState, setTimerState] = useState({
    segments: [],
    currentIndex: 0,
    remaining: 0,
    isRunning: false,
    title: 'Interval Timer',
  });
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthState({ user, loading: false });
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!authState.user) {
      setPlans(defaultPlans);
      setFavoritePlanId(defaultPlans[0]?.id || null);
      setSelectedPlanId(defaultPlans[0]?.id || 'plan-1');
      setPlansLoaded(false);
      return undefined;
    }
    const ref = doc(db, 'users', authState.user.uid, 'intervalTimer', 'plans');
    const unsub = onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        const fallbackFavorite = defaultPlans[0]?.id || 'plan-1';
        setPlans(defaultPlans);
        setFavoritePlanId(fallbackFavorite);
        setSelectedPlanId(fallbackFavorite);
        setPlansLoaded(true);
        setDoc(ref, {
          plans: defaultPlans,
          favoritePlanId: fallbackFavorite,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
        return;
      }
      const data = snapshot.data() || {};
      const rawPlans = Array.isArray(data.plans) ? data.plans : defaultPlans;
      const normalizedPlans = rawPlans.map((plan) => ({
        id: plan?.id || `plan-${Date.now()}`,
        title: plan?.title || 'Interval Timer',
        segments: Array.isArray(plan?.segments)
          ? plan.segments.map((segment) => ({
              label: segment?.label || '',
              minutes: segment?.minutes ?? 0,
              seconds: segment?.seconds ?? 0,
              repeat: segment?.repeat ?? 1,
            }))
          : [{ label: 'Work', minutes: 0, seconds: 30, repeat: 1 }],
      }));
      const favorite = data.favoritePlanId || normalizedPlans[0]?.id || 'plan-1';
      setPlans(normalizedPlans);
      setFavoritePlanId(favorite);
      setSelectedPlanId(favorite);
      setPlansLoaded(true);
    });
    return () => unsub();
  }, [authState.user, db, defaultPlans]);

  useEffect(() => {
    if (!authState.user || !plansLoaded) return;
    const ref = doc(db, 'users', authState.user.uid, 'intervalTimer', 'plans');
    setDoc(ref, {
      plans,
      favoritePlanId: favoritePlanId || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  }, [authState.user, favoritePlanId, plans, plansLoaded]);

  const unlockAudioContext = useCallback(() => {
    const AudioContextCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const playIntervalChime = useCallback(() => {
    const ctx = unlockAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    oscillator.start(now);
    oscillator.stop(now + 0.5);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 80, 120]);
    }
  }, [unlockAudioContext]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId]
  );
  const selectedPlanTotalSeconds = useMemo(
    () => getPlanTotalSeconds(selectedPlan),
    [selectedPlan]
  );


  const normalizedSegments = useMemo(() => {
    const segmentList = selectedPlan?.segments || [];
    return segmentList
      .map((segment) => {
        const minutes = parseNumber(segment.minutes);
        const seconds = parseNumber(segment.seconds);
        const durationSeconds = Math.max(0, minutes * 60 + seconds);
        const repeat = Math.max(1, Number(segment.repeat) || 1);
        return { ...segment, durationSeconds, repeat };
      })
      .filter((segment) => segment.durationSeconds > 0);
  }, [selectedPlan]);

  useEffect(() => {
    if (!timerState.isRunning || !timerState.segments.length) {
      return undefined;
    }
    const id = setInterval(() => {
      setTimerState((prev) => {
        if (!prev.isRunning) return prev;
        if (prev.remaining > 1) {
          return { ...prev, remaining: prev.remaining - 1 };
        }
        playIntervalChime();
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.segments.length) {
          return { ...prev, isRunning: false, remaining: 0, currentIndex: prev.currentIndex };
        }
        return {
          ...prev,
          currentIndex: nextIndex,
          remaining: prev.segments[nextIndex].durationSeconds,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerState.isRunning, timerState.segments.length, playIntervalChime]);

  const startTimer = () => {
    if (!normalizedSegments.length) return;
    const expandedSegments = normalizedSegments.flatMap((segment) =>
      Array.from({ length: segment.repeat }, (_, idx) => ({
        label: segment.label || '',
        durationSeconds: segment.durationSeconds,
        repeatIndex: idx + 1,
        repeatTotal: segment.repeat,
      }))
    );
    if (!expandedSegments.length) return;
    unlockAudioContext();
    setTimerState({
      segments: expandedSegments,
      currentIndex: 0,
      remaining: expandedSegments[0].durationSeconds,
      isRunning: true,
      title: selectedPlan?.title || 'Interval Timer',
    });
  };

  const pauseTimer = () => {
    setTimerState((prev) => ({ ...prev, isRunning: false }));
  };

  const resumeTimer = () => {
    if (!timerState.segments.length) return;
    unlockAudioContext();
    setTimerState((prev) => ({ ...prev, isRunning: true }));
  };

  const skipSegment = () => {
    setTimerState((prev) => {
      if (!prev.segments.length) return prev;
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.segments.length) {
        return { ...prev, isRunning: false, currentIndex: prev.segments.length - 1, remaining: 0 };
      }
      return {
        ...prev,
        currentIndex: nextIndex,
        remaining: prev.segments[nextIndex].durationSeconds,
      };
    });
  };

  const restartSegment = () => {
    setTimerState((prev) => {
      if (!prev.segments.length) return prev;
      const currentSegment = prev.segments[prev.currentIndex];
      if (!currentSegment) return prev;
      const elapsed = currentSegment.durationSeconds - prev.remaining;
      if (elapsed > 2) {
        return {
          ...prev,
          remaining: currentSegment.durationSeconds,
        };
      }
      const previousIndex = Math.max(prev.currentIndex - 1, 0);
      return {
        ...prev,
        currentIndex: previousIndex,
        remaining: prev.segments[previousIndex].durationSeconds,
      };
    });
  };

  const resetTimer = () => {
    setTimerState({
      segments: [],
      currentIndex: 0,
      remaining: 0,
      isRunning: false,
      title: selectedPlan?.title || 'Interval Timer',
    });
  };

  const handlePlanTitleChange = (value) => {
    setPlans((prev) =>
      prev.map((plan) => (plan.id === selectedPlanId ? { ...plan, title: value } : plan))
    );
  };

  const handleSegmentChange = (index, field, value) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== selectedPlanId) return plan;
        const nextSegments = [...plan.segments];
        if (field === 'repeat') {
          const repeatValue = Math.max(1, Number(value) || 1);
          nextSegments[index] = { ...nextSegments[index], repeat: repeatValue };
        } else {
          nextSegments[index] = { ...nextSegments[index], [field]: value };
        }
        return { ...plan, segments: nextSegments };
      })
    );
  };

  const addSegment = () => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === selectedPlanId
          ? { ...plan, segments: [...plan.segments, { label: '', minutes: 0, seconds: 30, repeat: 1 }] }
          : plan
      )
    );
  };

  const removeSegment = (index) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === selectedPlanId
          ? { ...plan, segments: plan.segments.filter((_, idx) => idx !== index) }
          : plan
      )
    );
  };

  const addPlan = () => {
    const nextId = `plan-${Date.now()}`;
    const nextPlan = {
      id: nextId,
      title: `Interval Timer ${plans.length + 1}`,
      segments: [{ label: 'Work', minutes: 0, seconds: 30, repeat: 1 }],
    };
    setPlans((prev) => [...prev, nextPlan]);
    setSelectedPlanId(nextId);
    if (!favoritePlanId) {
      setFavoritePlanId(nextId);
    }
    return nextId;
  };

  const removePlan = () => {
    if (plans.length <= 1) return;
    const nextPlans = plans.filter((plan) => plan.id !== selectedPlanId);
    setPlans(nextPlans);
    const nextId = nextPlans[0]?.id || 'plan-1';
    setSelectedPlanId(nextId);
    if (favoritePlanId === selectedPlanId) {
      setFavoritePlanId(nextId);
    }
  };

  const markAsFavorite = () => {
    if (selectedPlanId) {
      setFavoritePlanId(selectedPlanId);
    }
  };

  if (authState.loading) {
    return (
      <main className="workout-page">
        <p>Loading interval timer…</p>
      </main>
    );
  }

  if (!authState.user) {
    return (
      <main className="workout-auth-page">
        <IntervalTimerSignIn auth={auth} />
      </main>
    );
  }

  const current = timerState.segments[timerState.currentIndex];
  const next = timerState.segments[timerState.currentIndex + 1];
  const isRunning = timerState.isRunning && timerState.remaining > 0;
  const totalRemainingSeconds = timerState.segments.length
    ? timerState.remaining
      + timerState.segments
        .slice(timerState.currentIndex + 1)
        .reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0)
    : 0;
  const repeatTotal = current?.repeatTotal || 1;
  const repeatIndex = current?.repeatIndex || 1;
  const repeatsLeft = repeatTotal - repeatIndex + 1;

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <main className="workout-page">
      <header className="workout-hero">
        <div>
          <h1>Interval Timer</h1>
        </div>
      </header>

      <section className="interval-plan-header">
        <label>
          Choose plan
          <div className="interval-plan-selector">
            <select
              value={selectedPlanId}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === '__new__') {
                  const createdId = addPlan();
                  setSelectedPlanId(createdId);
                  return;
                }
                setSelectedPlanId(nextValue);
              }}
            >
              <option value="__new__">＋ New interval timer</option>
            {plans.map((plan) => {
              const totalSeconds = getPlanTotalSeconds(plan);
              const totalLabel = totalSeconds ? ` • ${formatSeconds(totalSeconds)}` : '';
              return (
                <option key={plan.id} value={plan.id}>
                  {favoritePlanId === plan.id ? '★ ' : ''}{plan.title || 'Untitled Plan'}{totalLabel}
                </option>
              );
            })}
          </select>
          <span className="interval-plan-selector__badge">
            {favoritePlanId === selectedPlanId ? 'Favorite' : 'Saved'}
          </span>
        </div>
      </label>
        <div className="interval-plan-header__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={markAsFavorite}
            disabled={favoritePlanId === selectedPlanId}
          >
            {favoritePlanId === selectedPlanId ? 'Favorited' : 'Set favorite'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={removePlan}
            disabled={plans.length <= 1}
          >
            Remove
          </button>
        </div>
      </section>

      {isEditingPlan && (
        <section className="interval-editor">
          <div className="interval-editor__header">
            <h3>Edit plan</h3>
            <div className="interval-editor__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setIsEditingPlan(false)}
              >
                Done
              </button>
            </div>
          </div>
          <label>
            Title
            <input
              type="text"
              value={selectedPlan?.title || ''}
              onChange={(event) => handlePlanTitleChange(event.target.value)}
              placeholder="e.g., Abs Flow"
            />
          </label>
          <div className="interval-editor__segments">
          {(selectedPlan?.segments || []).map((segment, index) => (
            <div key={index} className="interval-editor__row">
                <input
                  type="text"
                  value={segment.label || ''}
                  placeholder="Move name"
                  onChange={(event) => handleSegmentChange(index, 'label', event.target.value)}
                />
              <div className="interval-editor__duration">
                <input
                  type="number"
                  min="0"
                  value={segment.minutes}
                  placeholder="Min"
                  onChange={(event) => handleSegmentChange(index, 'minutes', event.target.value)}
                />
                <span> : </span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={segment.seconds}
                  placeholder="Sec"
                  onChange={(event) => handleSegmentChange(index, 'seconds', event.target.value)}
                />
              </div>
              <input
                type="number"
                min="1"
                value={segment.repeat || 1}
                placeholder="x"
                onChange={(event) => handleSegmentChange(index, 'repeat', event.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => removeSegment(index)}
                aria-label="Remove interval"
                >
                  <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" onClick={addSegment}>
              Add interval
            </button>
          </div>
        </section>
      )}

      {!isEditingPlan && (
        <article className="exercise-card interval-card">
          <div className="exercise-card__head">
          <div className="exercise-card__title">
            <h3>{selectedPlan?.title || 'Interval Timer'}</h3>
            <span className="interval-total">
              <span className="interval-total__label">Total time</span>
              <span className="interval-total__value">{formatDurationLabel(selectedPlanTotalSeconds)}</span>
            </span>
          </div>
            <div className="exercise-card__meta">
              <button type="button" className="btn btn--secondary" onClick={startTimer} disabled={!normalizedSegments.length}>
                Start
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setIsEditingPlan(true)}
              >
                Edit plan
              </button>
            </div>
          </div>
          <div className="exercise-card__body">
            <ul className="interval-list">
            {normalizedSegments.map((segment, index) => (
              <li key={index}>
                <span>
                  {segment.label || `Interval ${index + 1}`}
                  {segment.repeat > 1 ? ` ×${segment.repeat}` : ''}
                </span>
                <span className="interval-list__duration">{formatSeconds(segment.durationSeconds)}</span>
              </li>
            ))}
            </ul>
          </div>
        </article>
      )}

      {!isEditingPlan && timerState.segments.length > 0 && (
        <section className="interval-player">
          <div className="interval-player__time">
            <p className="interval-player__label">{current?.label || timerState.title}</p>
            <div className="interval-player__clock">{formatSeconds(timerState.remaining)}</div>
            {isRunning && repeatTotal > 1 && (
              <div className="interval-player__repeat">
                <span>Rep {repeatIndex} of {repeatTotal}</span>
                <div className="interval-player__repeat-bar">
                  <div
                    className="interval-player__repeat-fill"
                    style={{ width: `${(repeatIndex / repeatTotal) * 100}%` }}
                  />
                </div>
                <span>{repeatsLeft} left</span>
              </div>
            )}
            {isRunning && (
              <p className="help-text">Total time left: {formatSeconds(totalRemainingSeconds)}</p>
            )}
            {next && <p className="help-text">Next: {next.label}</p>}
          </div>
          <div className="interval-player__controls">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={restartSegment}
              aria-label="Restart or go back"
            >
              ←
            </button>
            {isRunning ? (
              <button type="button" className="btn btn--secondary" onClick={pauseTimer}>
                Pause
              </button>
            ) : (
              <button type="button" className="btn" onClick={resumeTimer} disabled={!timerState.segments.length}>
                Resume
              </button>
            )}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={skipSegment}
              aria-label="Skip interval"
            >
              →
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetTimer}>
              Reset
            </button>
          </div>
        </section>
      )}
      <div className="workout-edit-cta">
        <button type="button" className="btn btn--ghost" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </main>
  );
}

export default IntervalTimerProject;

function IntervalTimerSignIn({ auth }) {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getStoredRememberMe());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords must match.');
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="todo-auth">
      <section className="todo-auth__intro">
        <h1>Interval Timer Sign in</h1>
        <p>Build custom intervals and run them with audio cues across your devices.</p>
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
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
                onChange={(event) => setConfirmPassword(event.target.value)}
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
    </div>
  );
}
