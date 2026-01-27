import { useEffect, useState } from 'react';
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth, signOut, deleteUser } from 'firebase/auth';

import '../styles/style.css';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const formatDayAbbr = (day) => day.slice(0, 3);

const formatTime = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

function ToDo() {
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [reminders, setReminders] = useState([]);
  const [recurringReminders, setRecurringReminders] = useState([]);
  const [newReminder, setNewReminder] = useState("");
  const [dueDate, setDueDate] = useState(getTodayDate());
  const [newRecurring, setNewRecurring] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  // Collapsible section state variables
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showWeekly, setShowWeekly] = useState(true);
  const [showPastDue, setShowPastDue] = useState(true);

  const [reminderTime, setReminderTime] = useState(getCurrentTime());
  const [recurringTime, setRecurringTime] = useState(getCurrentTime());
  const [newReminderAllDay, setNewReminderAllDay] = useState(false);
  const [newRecurringAllDay, setNewRecurringAllDay] = useState(false);

  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = '/to-do-signin';
    } catch (err) {
      alert('Error signing out: ' + err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your account?')) {
      try {
        await deleteUser(auth.currentUser);
        alert('Account deleted.');
        window.location.href = '/to-do-signin';
      } catch (err) {
        alert('Error deleting account: ' + err.message);
      }
    }
  };

  const fetchReminders = async (user) => {
    const snapshot = await getDocs(collection(db, "reminders"));
    const recSnapshot = await getDocs(collection(db, "recurringReminders"));
    const today = new Date().toISOString().split('T')[0];

    const rawReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const rawRecurring = recSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const filteredReminders = rawReminders.filter(r => r.userId === user.uid);
    const filteredRecurring = rawRecurring.filter(r => r.userId === user.uid);

    setReminders(filteredReminders.map(r => ({
      ...r,
      pastDue: r.dueDate < today,
      completed: !!r.completed,
      completedAt: r.completedAt || null,
      allDay: !!r.allDay,
    })));
    setRecurringReminders(filteredRecurring.map(r => ({
      ...r,
      allDay: !!r.allDay,
    })));
  };

  const addReminder = async () => {
    const user = auth.currentUser;
    if (!user) return alert("User not authenticated.");

    await addDoc(collection(db, "reminders"), {
      title: newReminder,
      dueDate,
      time: newReminderAllDay ? null : reminderTime,
      userId: user.uid,
      completed: false,
      createdAt: new Date().toISOString(),
      allDay: newReminderAllDay,
    });
    setNewReminder("");
    setDueDate(getTodayDate());
    setReminderTime(getCurrentTime());
    setNewReminderAllDay(false);
    fetchReminders(user);
  };

const addRecurringReminder = async () => {
    const user = auth.currentUser;
    if (!user) return alert("User not authenticated.");

    await addDoc(collection(db, "recurringReminders"), {
      title: newRecurring,
      days: selectedDays,
      time: newRecurringAllDay ? null : recurringTime,
      userId: user.uid,
      allDay: newRecurringAllDay,
    });
    setNewRecurring("");
    setSelectedDays([]);
    setRecurringTime(getCurrentTime());
    setNewRecurringAllDay(false);
    fetchReminders(user);
};

const deleteReminder = async (id) => {
  if (!id) return;
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert("User not authenticated.");
    return;
  }
  try {
    const reminderRef = doc(db, "reminders", id);
    const snapshot = await getDoc(reminderRef);
    const data = snapshot.data();
    if (data?.userId !== currentUser.uid) {
      alert("You do not have permission to delete this reminder.");
      return;
    }
    await deleteDoc(reminderRef);
    fetchReminders(currentUser);
  } catch (err) {
    console.error("Failed to delete reminder:", err.message);
    alert("Unable to delete reminder. Please check your permissions.");
  }
};

const updateReminderCompletion = async (id, completed, reminder) => {
    if (!id) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("User not authenticated.");
      return;
    }
    try {
      const reminderRef = doc(db, "reminders", id);
      const snapshot = await getDoc(reminderRef);
      const data = snapshot.data() || {};
      const ownerId = data.userId || reminder?.userId;
      if (ownerId !== currentUser.uid) {
        alert("You do not have permission to update this reminder.");
        return;
      }
      const payload = completed
        ? { completed: true, completedAt: new Date().toISOString() }
        : {
            completed: false,
            completedAt: null,
            dueDate: reminder?.dueDate || data.dueDate || getTodayDate(),
            time: reminder?.time || data.time || getCurrentTime(),
          };
      await updateDoc(reminderRef, payload);
      setReminders((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
      fetchReminders(currentUser);
    } catch (err) {
      console.error("Failed to update reminder:", err.message);
      alert("Unable to update reminder. Please check your permissions.");
    }
  };

  const deleteRecurringReminder = async (id) => {
    try {
      const reminderRef = doc(db, "recurringReminders", id);
      const snapshot = await getDoc(reminderRef);
      const data = snapshot.data();
      if (data.userId === auth.currentUser.uid) {
        await deleteDoc(reminderRef);
        fetchReminders(auth.currentUser);
      } else {
        alert("You do not have permission to delete this recurring reminder.");
      }
    } catch (err) {
      console.error("Failed to delete recurring reminder:", err.message);
      alert("Unable to delete recurring reminder. Please check your permissions.");
    }
  };

const markRecurringComplete = async (id, dateStr) => {
    try {
      const reminderRef = doc(db, "recurringReminders", id);
      const snapshot = await getDoc(reminderRef);
      const data = snapshot.data();
      if (data.userId === auth.currentUser.uid) {
        const updatedDates = new Set(data.completedDates || []);
        updatedDates.add(dateStr);
        await updateDoc(reminderRef, { completedDates: Array.from(updatedDates) });
        fetchReminders(auth.currentUser);
      } else {
        alert("You do not have permission to update this recurring reminder.");
      }
    } catch (err) {
      console.error("Failed to update recurring reminder:", err.message);
      alert("Unable to mark recurring reminder. Please check your permissions.");
    }
};

const unmarkRecurringComplete = async (id, dateStr) => {
  try {
    const reminderRef = doc(db, "recurringReminders", id);
    const snapshot = await getDoc(reminderRef);
    const data = snapshot.data();
    if (data.userId === auth.currentUser.uid) {
      const updatedDates = new Set(data.completedDates || []);
      updatedDates.delete(dateStr);
      await updateDoc(reminderRef, { completedDates: Array.from(updatedDates) });
      fetchReminders(auth.currentUser);
    } else {
      alert("You do not have permission to update this recurring reminder.");
    }
  } catch (err) {
    console.error("Failed to update recurring reminder:", err.message);
    alert("Unable to revert recurring reminder. Please check your permissions.");
  }
};

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchReminders(user);
      }
    });
    return () => unsubscribe();
  }, []);

  // Calculate start (Sunday) and end (Saturday) dates for the current week
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const weekRangeString = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const renderTimeChip = (item) => {
    if (item.allDay) {
      return <span className="reminder-time reminder-time--all-day">All day</span>;
    }
    if (item.time) {
      return <span className="reminder-time">{formatTime(item.time)}</span>;
    }
    return null;
  };

  const weekLayout = daysOfWeek.map((day, i) => {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    const specificReminders = reminders.filter(r => {
      // Treat r.dueDate as local date by appending T00:00:00
      const reminderDate = new Date(r.dueDate + 'T00:00:00');
      return reminderDate.getFullYear() === currentDate.getFullYear()
        && reminderDate.getMonth() === currentDate.getMonth()
        && reminderDate.getDate() === currentDate.getDate()
        && !r.pastDue
        && !r.completed;
    });
    const recurringForDay = recurringReminders.filter(r => {
      const completedDates = r.completedDates || [];
      const isCompletedToday = completedDates.includes(currentDate.toISOString().split('T')[0]);
      return r.days.includes(day) && !isCompletedToday;
    });

    const combined = [...specificReminders, ...recurringForDay].sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

    return (
      <div key={day}>
        <h4>{day} - {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h4>
        <ul className="reminder-list">
          {combined.map((r, idx) => {
            const handleToggle = () => {
              const reminderId = r.id;
              if (!reminderId) return;
              if (Array.isArray(r.days) && r.days.length) {
                const completedDate = currentDate.toISOString().split('T')[0];
                markRecurringComplete(reminderId, completedDate);
              } else {
                updateReminderCompletion(reminderId, !r.completed, r);
              }
            };
            const isRecurringItem = Array.isArray(r.days) && r.days.length > 0;
            const cardClasses = ['reminder-card'];
            if (isRecurringItem) {
              cardClasses.push('reminder-card--recurring');
            } else {
              cardClasses.push('reminder-card--regular');
            }
            if (r.completed) {
              cardClasses.push('is-complete');
            }
            const handleDelete = (event) => {
              event.stopPropagation();
              if (!r.id) return;
              if (isRecurringItem) {
                deleteRecurringReminder(r.id);
              } else {
                deleteReminder(r.id);
              }
            };
            return (
              <li
                key={r.id || idx}
                className={cardClasses.join(' ')}
                role="button"
                tabIndex={0}
                onClick={handleToggle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleToggle();
                  }
                }}
              >
                <div className="reminder-card__body">
                  <div className="reminder-details">
                    <span className="reminder-title">{r.title}</span>
                    <span className="reminder-meta">
                      {renderTimeChip(r)}
                      {r.dueDate && (
                        <span className="reminder-date">{formatDateDisplay(r.dueDate)}</span>
                      )}
                    </span>
                  </div>
                </div>
                {r.id && (
                  <div className="reminder-actions">
                    <button
                      type="button"
                      className="icon-button icon-button--trash"
                      onClick={handleDelete}
                      aria-label={isRecurringItem ? 'Delete recurring reminder' : 'Delete reminder'}
                    >
                      <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  });

  const toggleDay = (day) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const completedReminders = reminders.filter((r) => {
    if (!r.completed) return false;
    const reference = r.completedAt
      ? new Date(r.completedAt)
      : new Date(r.dueDate + 'T00:00:00');
    if (Number.isNaN(reference?.getTime())) return false;
    return reference >= startOfWeek && reference <= endOfWeek;
  });

  const completedRecurring = recurringReminders.flatMap((r) => {
    const completedDates = r.completedDates || [];
    return completedDates
      .map((date) => {
        const reference = new Date(date + 'T00:00:00');
        if (Number.isNaN(reference.getTime())) {
          return null;
        }
        if (reference < startOfWeek || reference > endOfWeek) {
          return null;
        }
        return {
          id: `${r.id}-${date}`,
          title: r.title,
          time: r.time,
          completedDate: date,
          recurringId: r.id,
          days: r.days,
          allDay: r.allDay,
        };
      })
      .filter(Boolean);
  });

  const completedThisWeek = [...completedReminders, ...completedRecurring];

  const handleToggleAllDay = (setAllDay, setTime) => (event) => {
    const next = event.target.checked;
    setAllDay(next);
    if (next) {
      setTime('');
    } else {
      setTime(getCurrentTime());
    }
  };

  return (
    <>
      <div className="dashboard-toggle-group">
        <button
          type="button"
          className={`dashboard-toggle${showNewReminder ? ' is-active' : ''}`}
          onClick={() => setShowNewReminder((prev) => !prev)}
          aria-pressed={showNewReminder}
        >
          <span aria-hidden="true">＋</span>
          <span>New Reminder</span>
        </button>
        <button
          type="button"
          className={`dashboard-toggle${showRecurring ? ' is-active' : ''}`}
          onClick={() => setShowRecurring((prev) => !prev)}
          aria-pressed={showRecurring}
        >
          <span aria-hidden="true">⟳</span>
          <span>Recurring Reminder</span>
        </button>
      </div>

      {showNewReminder && (
        <div className="section todo-section">
          <h2 onClick={() => setShowNewReminder(false)}>New Reminder</h2>
          <input type="text" value={newReminder} onChange={e => setNewReminder(e.target.value)} placeholder="Reminder title..." />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <div className="field-row">
            <input
              type="time"
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              disabled={newReminderAllDay}
            />
            <label className={`toggle ${newReminderAllDay ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                checked={newReminderAllDay}
                onChange={handleToggleAllDay(setNewReminderAllDay, setReminderTime)}
              />
              <span className="toggle__track">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">All day</span>
            </label>
          </div>
          <button className="todo-button" onClick={addReminder}>Add Reminder</button>
        </div>
      )}

      {showRecurring && (
        <div className="section todo-section">
          <h2 onClick={() => setShowRecurring(false)}>Recurring Reminders</h2>
          <input type="text" value={newRecurring} onChange={e => setNewRecurring(e.target.value)} placeholder="Recurring task title..." />
          <div className="field-row">
            <input
              type="time"
              value={recurringTime}
              onChange={e => setRecurringTime(e.target.value)}
              disabled={newRecurringAllDay}
            />
            <label className={`toggle ${newRecurringAllDay ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                checked={newRecurringAllDay}
                onChange={handleToggleAllDay(setNewRecurringAllDay, setRecurringTime)}
              />
              <span className="toggle__track">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">All day</span>
            </label>
          </div>
          <label className="field-label" htmlFor="recurring-day-select">
            Select days
          </label>
          <div className="day-dropdown">
            <select
              id="recurring-day-select"
              onChange={(event) => {
                const value = event.target.value;
                if (value) {
                  toggleDay(value);
                }
                event.target.value = '';
              }}
              value=""
            >
              <option value="" disabled>
                Choose a day…
              </option>
              {daysOfWeek.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="day-chip-row" aria-live="polite">
            {selectedDays.length === 0 ? (
              <span className="day-chip day-chip--empty">No days selected</span>
            ) : (
              selectedDays.map((day) => (
                <button
                  type="button"
                  key={day}
                  className="day-chip"
                  onClick={() => toggleDay(day)}
                  title={`Remove ${day}`}
                  aria-label={`Remove ${day}`}
                >
                  <span className="day-chip__abbr">{formatDayAbbr(day)}</span>
                  <span className="sr-only">{day}</span>
                  <span className="day-chip__remove" aria-hidden="true">×</span>
                </button>
              ))
            )}
          </div>
          <button className="todo-button" onClick={addRecurringReminder}>Add Recurring</button>

          <h3>Scheduled Recurring Tasks</h3>
          <ul className="reminder-list">
            {recurringReminders.map((r) => (
              <li key={r.id} className="reminder-card reminder-card--recurring">
                <div className="reminder-card__body">
                  <div className="reminder-details">
                    <span className="reminder-title">{r.title}</span>
                    <span className="reminder-meta">
                    {renderTimeChip(r)}
                      <span className="reminder-date">{r.days.map(formatDayAbbr).join(', ')}</span>
                    </span>
                  </div>
                </div>
                <div className="reminder-actions">
                  <button
                    type="button"
                    className="icon-button icon-button--trash"
                    onClick={() => deleteRecurringReminder(r.id)}
                    aria-label="Delete recurring reminder"
                  >
                    <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section todo-section">
        <h2 onClick={() => setShowWeekly(!showWeekly)}>
          Reminders for the Week ({weekRangeString})
        </h2>
        {showWeekly && weekLayout}
        {showWeekly && (
          <div className="completed-list">
            <h3>Completed This Week</h3>
            {completedThisWeek.length === 0 ? (
              <p className="help-text">No reminders completed yet.</p>
            ) : (
              <ul className="reminder-list">
                {completedThisWeek.map((r) => {
                  const handleToggle = () => {
                    if (r.recurringId) {
                      unmarkRecurringComplete(r.recurringId, r.completedDate);
                    } else {
                      updateReminderCompletion(r.id, false, r);
                    }
                  };
                  return (
                    <li
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      className="reminder-card reminder-card--completed"
                      onClick={handleToggle}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleToggle();
                        }
                      }}
                    >
                      <div className="reminder-card__body">
                        <div className="reminder-details reminder-details--completed">
                          <span className="reminder-title">{r.title}</span>
                          <span className="reminder-meta">
                            {r.completedDate
                              ? <span className="reminder-date">{formatDateDisplay(r.completedDate)}</span>
                              : r.dueDate && <span className="reminder-date">{formatDateDisplay(r.dueDate)}</span>}
                      {renderTimeChip(r)}
                          </span>
                        </div>
                      </div>
                      <div className="reminder-actions reminder-actions--completed">
                        <span className="icon-indicator icon-indicator--check" aria-hidden="true">✓</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="section todo-section">
        <h2 onClick={() => setShowPastDue(!showPastDue)}>Past Due</h2>
        {showPastDue && (
          <ul className="reminder-list">
            {reminders
              .filter(r => r.pastDue)
              .map(r => (
                <li key={r.id} className="reminder-card reminder-card--past-due">
                  <div className="reminder-card__body">
                    <div className="reminder-details">
                      <span className="reminder-title">{r.title}</span>
                      <span className="reminder-meta">
                            {renderTimeChip(r)}
                        {r.dueDate && <span className="reminder-date">{formatDateDisplay(r.dueDate)}</span>}
                      </span>
                    </div>
                  </div>
                  <div className="reminder-actions">
                    <button
                      type="button"
                      className="icon-button icon-button--trash"
                      onClick={() => deleteReminder(r.id)}
                      aria-label="Delete reminder"
                    >
                      <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="section todo-section account-actions">
        <button className="todo-button" onClick={handleSignOut}>Sign Out</button>
        <button
          className="todo-button todo-button--danger"
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>
      </div>
    </>
  );
}

export default ToDo;
