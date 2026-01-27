import { useEffect, useState } from 'react';
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth, signOut, deleteUser } from 'firebase/auth';

import '../styles/style.css';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatTime = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
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
  const [showNewReminder, setShowNewReminder] = useState(true);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showWeekly, setShowWeekly] = useState(true);
  const [showPastDue, setShowPastDue] = useState(true);

  const [reminderTime, setReminderTime] = useState(getCurrentTime());
  const [recurringTime, setRecurringTime] = useState(getCurrentTime());

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

    setReminders(filteredReminders.map(r => ({ ...r, pastDue: r.dueDate < today })));
    setRecurringReminders(filteredRecurring);
  };

  const addReminder = async () => {
    const user = auth.currentUser;
    if (!user) return alert("User not authenticated.");

    await addDoc(collection(db, "reminders"), {
      title: newReminder,
      dueDate,
      time: reminderTime,
      userId: user.uid,
      createdAt: new Date().toISOString()
    });
    setNewReminder("");
    setDueDate(getTodayDate());
    setReminderTime(getCurrentTime());
    fetchReminders(user);
  };

  const addRecurringReminder = async () => {
    const user = auth.currentUser;
    if (!user) return alert("User not authenticated.");

    await addDoc(collection(db, "recurringReminders"), {
      title: newRecurring,
      days: selectedDays,
      time: recurringTime,
      userId: user.uid
    });
    setNewRecurring("");
    setSelectedDays([]);
    setRecurringTime(getCurrentTime());
    fetchReminders(user);
  };

  const deleteReminder = async (id) => {
    try {
      const reminderRef = doc(db, "reminders", id);
      const snapshot = await getDoc(reminderRef);
      const data = snapshot.data();
      if (data.userId === auth.currentUser.uid) {
        await deleteDoc(reminderRef);
        fetchReminders(auth.currentUser);
      } else {
        alert("You do not have permission to delete this reminder.");
      }
    } catch (err) {
      console.error("Failed to delete reminder:", err.message);
      alert("Unable to delete reminder. Please check your permissions.");
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
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const weekRangeString = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const weekLayout = daysOfWeek.map((day, i) => {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    const specificReminders = reminders.filter(r => {
      // Treat r.dueDate as local date by appending T00:00:00
      const reminderDate = new Date(r.dueDate + 'T00:00:00');
      return reminderDate.getFullYear() === currentDate.getFullYear()
        && reminderDate.getMonth() === currentDate.getMonth()
        && reminderDate.getDate() === currentDate.getDate()
        && !r.pastDue;
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
        <ul>
          {combined.map((r, idx) => (
            <li key={r.id || idx}>
              <input
                type="checkbox"
                checked={false}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  if (r.id && r.days) {
                    const completedDate = currentDate.toISOString().split('T')[0];
                    markRecurringComplete(r.id, completedDate);
                  } else if (r.id) {
                    deleteReminder(r.id);
                  }
                }}
              />
              {r.title} {r.time && `@ ${formatTime(r.time)}`}
            </li>
          ))}
        </ul>
      </div>
    );
  });

  const toggleDay = (day) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="dashboard">
      <div className="header-icons">
        <span className="top-left-icon" onClick={() => setShowNewReminder(!showNewReminder)}>
          <i className="fas fa-thumbtack"></i>
        </span>
        <span className="top-right-icon" onClick={() => setShowRecurring(!showRecurring)}>
          <i className="fas fa-sync-alt"></i>
        </span>
      </div>

      {showNewReminder && (
        <div className="section">
          <h2 onClick={() => setShowNewReminder(false)}>New Reminder</h2>
          <input type="text" value={newReminder} onChange={e => setNewReminder(e.target.value)} placeholder="Reminder title..." />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
          <button onClick={addReminder}>Add Reminder</button>
        </div>
      )}

      {showRecurring && (
        <div className="section">
          <h2 onClick={() => setShowRecurring(false)}>Recurring Reminders</h2>
          <input type="text" value={newRecurring} onChange={e => setNewRecurring(e.target.value)} placeholder="Recurring task title..." />
          <input type="time" value={recurringTime} onChange={e => setRecurringTime(e.target.value)} />
          <div>
            {daysOfWeek.map(day => (
              <label key={day}>
                <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />
                {day}
              </label>
            ))}
          </div>
          <button onClick={addRecurringReminder}>Add Recurring</button>

          <h3>Scheduled Recurring Tasks</h3>
          <ul>
            {recurringReminders.map(r => (
              <li key={r.id}>
                {r.title} {r.time && `@ ${formatTime(r.time)}`} on {r.days.join(', ')}
                <button
                  onClick={() => deleteRecurringReminder(r.id)}
                  style={{
                    marginLeft: '1em',
                    backgroundColor: 'var(--color-danger)',
                    color: 'var(--color-primary-contrast)'
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section">
        <h2 onClick={() => setShowWeekly(!showWeekly)}>
          Reminders for the Week ({weekRangeString})
        </h2>
        {showWeekly && weekLayout}
      </div>

      <div className="section">
        <h2 onClick={() => setShowPastDue(!showPastDue)}>Past Due</h2>
        {showPastDue && (
          <ul>
            {reminders
              .filter(r => r.pastDue)
              .map(r => (
                <li key={r.id}>
                  <input type="checkbox" onChange={() => deleteReminder(r.id)} />
                  {r.title} {r.time && `@ ${r.time}`} (Due: {new Date(r.dueDate).toDateString()})
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="section">
        <button onClick={handleSignOut}>Sign Out</button>
        <button
          onClick={handleDeleteAccount}
          style={{
            marginLeft: '1em',
            backgroundColor: 'var(--color-danger)',
            color: 'var(--color-primary-contrast)'
          }}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

export default ToDo;
