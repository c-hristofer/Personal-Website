import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { toPng } from 'html-to-image';
import { getWeekInfo, getWeekStartDateFromId } from '../../workout/date';
import {
  subscribeToSettings,
  subscribeToWorkoutHistory,
} from '../../workout/service';
import {
  computeDeloadState,
  convertUnitValue,
} from '../../workout/utils';
import '../../styles/style.css';

const RANGE_OPTIONS = [8, 12, 24];
const MAX_SERIES = 4;
const CHART_COLORS = ['#F5222D', '#1677FF', '#FAAD14', '#52C41A'];

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const weekLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const formatWeekLabel = (weekId) => {
  const date = getWeekStartDateFromId(weekId);
  if (!date) return weekId;
  return weekLabelFormatter.format(date);
};

function WorkoutData() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [authState, setAuthState] = useState({ user: null, loading: true });
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [rangeWeeks, setRangeWeeks] = useState(12);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [weekInfo, setWeekInfo] = useState(() => getWeekInfo());
  const chartRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthState({ user, loading: false });
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    const id = setInterval(() => setWeekInfo(getWeekInfo()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authState.user) {
      setSettings(null);
      setHistory([]);
      return;
    }
    const unsubSettings = subscribeToSettings(authState.user.uid, (data) => setSettings(data));
    const unsubHistory = subscribeToWorkoutHistory(authState.user.uid, 52, (docs) => {
      setHistory(docs);
    });
    return () => {
      unsubSettings();
      unsubHistory();
    };
  }, [authState.user]);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => a.weekId.localeCompare(b.weekId)),
    [history]
  );

  const filteredHistory = useMemo(() => {
    if (!rangeWeeks || sortedHistory.length <= rangeWeeks) {
      return sortedHistory;
    }
    return sortedHistory.slice(sortedHistory.length - rangeWeeks);
  }, [rangeWeeks, sortedHistory]);

  const exerciseOptions = useMemo(() => {
    const map = new Map();
    sortedHistory.forEach((doc) => {
      const summaries = doc.exerciseSummaries || {};
      Object.keys(summaries).forEach((exerciseId) => {
        const name = summaries[exerciseId]?.name || 'Exercise';
        const key = name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { id: key, name });
        }
      });
    });
    return Array.from(map.values());
  }, [sortedHistory]);

  useEffect(() => {
    if (!exerciseOptions.length) {
      setIsDropdownOpen(false);
      setExerciseSearch('');
    }
  }, [exerciseOptions.length]);

  const getColorForIndex = (index) => CHART_COLORS[index % CHART_COLORS.length];

  const filteredExerciseOptions = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    if (!query) return exerciseOptions;
    return exerciseOptions.filter((option) => option.name.toLowerCase().includes(query));
  }, [exerciseOptions, exerciseSearch]);

  useEffect(() => {
    if (!selectedExercises.length) return;
    const validIds = new Set(exerciseOptions.map((option) => option.id));
    if (selectedExercises.every((id) => validIds.has(id))) {
      return;
    }
    setSelectedExercises((prev) => prev.filter((id) => validIds.has(id)));
  }, [exerciseOptions, selectedExercises]);

  const deloadState = useMemo(
    () => computeDeloadState(settings, weekInfo.weekId),
    [settings, weekInfo.weekId]
  );
  const isDeloadWeek = deloadState.isDeloadWeek && deloadState.deloadEnabled;
  const unitLabel = (settings?.unitSystem || 'lbs').toUpperCase();

  const chartData = useMemo(() => {
    const targetUnit = settings?.unitSystem || 'lbs';
    return filteredHistory.map((doc) => {
      const point = {
        weekId: doc.weekId,
        label: formatWeekLabel(doc.weekId),
      };
      const mergedByName = new Map();
      Object.values(doc.exerciseSummaries || {}).forEach((summary) => {
        const name = (summary?.name || 'Exercise').toLowerCase().trim();
        if (!mergedByName.has(name)) {
          mergedByName.set(name, []);
        }
        if (summary?.value !== undefined && summary.value !== null) {
          mergedByName.get(name).push(Number(summary.value));
        }
      });
      selectedExercises.forEach((exerciseId) => {
        const values = mergedByName.get(exerciseId) || [];
        if (values.length) {
          const maxValue = Math.max(...values);
          const converted = convertUnitValue(
            maxValue,
            doc.unitSystem || 'lbs',
            targetUnit
          );
          point[exerciseId] = Number.isFinite(converted)
            ? Math.round(converted * 100) / 100
            : null;
        } else {
          point[exerciseId] = null;
        }
      });
      return point;
    });
  }, [filteredHistory, selectedExercises, settings?.unitSystem]);

  const buildHistoryRows = (docs, filterSet) => {
    const rows = [];
    docs.forEach((doc) => {
      const entries = doc.exerciseSummaries || {};
      const merged = new Map();
      Object.keys(entries).forEach((exerciseId) => {
        const summary = entries[exerciseId] || {};
        const name = (summary.name || 'Exercise').toLowerCase().trim();
        if (filterSet && !filterSet.has(name)) return;
        if (!merged.has(name)) {
          merged.set(name, {
            name: summary.name || 'Exercise',
            values: [],
            hasNumericData: false,
            source: summary.source || '',
          });
        }
        const bucket = merged.get(name);
        bucket.hasNumericData = bucket.hasNumericData || Boolean(summary.hasNumericData);
        if (summary.value !== undefined && summary.value !== null) {
          bucket.values.push(Number(summary.value));
        }
      });
      const mergedList = Array.from(merged.values());
      if (!mergedList.length) {
        rows.push({
          weekId: doc.weekId,
          weekStartISO: doc.weekStartISO || doc.weekId,
          unitSystem: doc.unitSystem || 'lbs',
          exerciseId: '',
          exerciseName: '',
          value: '',
          source: '',
          hasNumericData: '',
          createdAt: doc.createdAt || '',
          updatedAt: doc.updatedAt || '',
        });
      } else {
        mergedList.forEach((summary) => {
          const maxValue = summary.values.length ? Math.max(...summary.values) : '';
          rows.push({
            weekId: doc.weekId,
            weekStartISO: doc.weekStartISO || doc.weekId,
            unitSystem: doc.unitSystem || 'lbs',
            exerciseId: summary.name || '',
            exerciseName: summary.name || '',
            value: maxValue === '' ? '' : maxValue,
            source: summary.source || '',
            hasNumericData: summary.hasNumericData ?? false,
            createdAt: doc.createdAt || '',
            updatedAt: doc.updatedAt || '',
          });
        });
      }
    });
    return rows;
  };

  const downloadCsv = (rows, filename) => {
    const csvRows = rows.length ? rows : [{ message: 'No data available' }];
    const headers = Array.from(
      csvRows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set())
    );
    const lines = [
      headers.map((header) => csvEscape(header)).join(','),
      ...csvRows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHistory = (selectedOnly) => {
    if (!sortedHistory.length) return;
    if (selectedOnly && selectedExercises.length === 0) return;
    const filterSet = selectedOnly ? new Set(selectedExercises) : null;
    const rows = buildHistoryRows(sortedHistory, filterSet);
    downloadCsv(
      rows,
      selectedOnly ? 'workout-history-selected.csv' : 'workout-history-all.csv'
    );
  };

  const handleSaveChartImage = async () => {
    if (!chartRef.current || !filteredHistory.length) return;
    try {
      const dataUrl = await toPng(chartRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `workout-chart-${new Date().toISOString()}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to save chart image', error);
    }
  };

  if (authState.loading) {
    return (
      <main className="workout-page">
        <p>Loading data…</p>
      </main>
    );
  }

  if (!authState.user) {
    return (
      <main className="workout-page">
        <p>You need to sign in to view your workout history.</p>
        <button type="button" className="btn" onClick={() => navigate('/workout')}>
          Back to Workout
        </button>
      </main>
    );
  }

  return (
    <main className={`workout-page${isDeloadWeek ? ' workout-page--deload' : ''}`}>
      <header className="workout-hero workout-hero--settings">
        <div>
          <h1>Workout Data</h1>
          <p className="help-text">Visualize your weekly strength progress.</p>
        </div>
        <button
          type="button"
          className="workout-hero__back"
          onClick={() => navigate('/workout')}
          aria-label="Back"
        >
          <img src="/icons/chevron-left.svg" alt="" aria-hidden="true" />
        </button>
      </header>
      {isDeloadWeek && (
        <div className="deload-banner" role="status" aria-live="polite">
          <strong>DELOAD WEEK ACTIVE</strong>
          <span>Exercise weights reduced by {Math.round(deloadState.deloadPercent)}%.</span>
        </div>
      )}
      <section className="workout-panel workout-panel--data">
        <div className="workout-toolbar workout-toolbar--data">
          <div>
            <h2>Exercises</h2>
            <p className="help-text">Select up to {MAX_SERIES} exercises to compare.</p>
          </div>
          <div className="range-toggle">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={option === rangeWeeks ? 'is-active' : ''}
                onClick={() => setRangeWeeks(option)}
              >
                Last {option}w
              </button>
            ))}
          </div>
        </div>
        <div className="data-actions">
          <div className="data-actions__group">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => handleExportHistory(false)}
              disabled={!sortedHistory.length}
            >
              Export all data
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => handleExportHistory(true)}
              disabled={!sortedHistory.length || !selectedExercises.length}
            >
              Export selected
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleSaveChartImage}
            disabled={!filteredHistory.length}
          >
            Save graph image
          </button>
        </div>
        <div className="exercise-picker" ref={dropdownRef}>
          <div className={`exercise-search${isDropdownOpen ? ' is-open' : ''}`}>
            <input
              type="text"
              placeholder={exerciseOptions.length ? 'Search exercises…' : 'No history yet'}
              value={exerciseSearch}
              onChange={(event) => {
                setExerciseSearch(event.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              disabled={!exerciseOptions.length}
            />
            <button
              type="button"
              className="exercise-search__toggle"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              disabled={!exerciseOptions.length}
              aria-label="Toggle exercise list"
            >
              {isDropdownOpen ? '▲' : '▼'}
            </button>
          </div>
          {exerciseOptions.length === 0 && (
            <p className="help-text">History populates after your first full week.</p>
          )}
          {isDropdownOpen && exerciseOptions.length > 0 && (
            <ul className="exercise-dropdown">
              {filteredExerciseOptions.length === 0 && (
                <li className="exercise-dropdown__empty">No matches</li>
              )}
              {filteredExerciseOptions.map((option) => {
                const isSelected = selectedExercises.includes(option.id);
                const atLimit = selectedExercises.length >= MAX_SERIES;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExercises((prev) => {
                          if (prev.includes(option.id)) {
                            return prev;
                          }
                          if (atLimit) return prev;
                          return [...prev, option.id];
                        });
                        setExerciseSearch('');
                        setIsDropdownOpen(false);
                      }}
                      disabled={isSelected || atLimit}
                    >
                      {option.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedExercises.length > 0 && (
            <div className="exercise-selected">
        {selectedExercises.map((exerciseId, idx) => {
                const option = exerciseOptions.find((opt) => opt.id === exerciseId);
                const color = getColorForIndex(idx);
                return (
                  <span key={exerciseId} className="exercise-chip" style={{ borderColor: color }}>
                    <span className="exercise-chip__dot" style={{ background: color }} />
                    {option?.name || 'Exercise'}
                    <button
                      type="button"
                      className="exercise-chip__remove"
                      onClick={() => {
                        setSelectedExercises((prev) => prev.filter((id) => id !== exerciseId));
                      }}
                      aria-label={`Remove ${option?.name || 'exercise'}`}
                    >
                      <img src="/icons/trash.svg" alt="" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {selectedExercises.length === 0 && (
            <p className="help-text">Pick up to {MAX_SERIES} exercises to plot.</p>
          )}
        </div>
      </section>
      <section className="workout-panel workout-panel--graph">
        <div className="workout-panel__header">
          <h2>Weekly max set weight</h2>
          <span className="help-text">Values shown in {unitLabel}</span>
        </div>
        {filteredHistory.length === 0 && (
          <div className="chart-empty">
            <p>No history yet. Come back after the next week rollover.</p>
          </div>
        )}
        {filteredHistory.length > 0 && (
          <div className="chart-wrapper" ref={chartRef}>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted)"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  stroke="var(--color-muted)"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  domain={['auto', 'auto']}
                  allowDecimals
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  labelStyle={{ color: 'var(--color-muted)' }}
                />
                <Legend />
                {selectedExercises.map((exerciseId, index) => {
                  const option = exerciseOptions.find((opt) => opt.id === exerciseId);
                  const strokeColor = getColorForIndex(index);
                  return (
                    <Line
                      key={exerciseId}
                      type="monotone"
                      dataKey={exerciseId}
                      name={option?.name || 'Exercise'}
                      stroke={strokeColor}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}

export default WorkoutData;
