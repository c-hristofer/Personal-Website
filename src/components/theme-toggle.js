import { useEffect, useState, useCallback } from 'react';
import { themeManager } from '../theme';

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function ThemeToggle() {
  const [preference, setPreference] = useState(themeManager.getPreference());
  const [effectiveTheme, setEffectiveTheme] = useState(themeManager.getEffectiveTheme());

  useEffect(() => {
    themeManager.init();
    const unsubscribe = themeManager.subscribe(({ preference: pref, effectiveTheme: theme }) => {
      setPreference(pref);
      setEffectiveTheme(theme);
    });
    return unsubscribe;
  }, []);

  const handleSelect = useCallback((mode) => {
    if (mode !== preference) {
      themeManager.setPreference(mode);
    }
  }, [preference]);

  const handleKeyDown = useCallback((event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const index = MODES.findIndex((mode) => mode.value === preference);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + MODES.length) % MODES.length;
    themeManager.setPreference(MODES[nextIndex].value);
  }, [preference]);

  return (
    <div
      className="theme-toggle"
      role="radiogroup"
      aria-label="Theme mode"
      onKeyDown={handleKeyDown}
    >
      {MODES.map((mode) => {
        const isActive = mode.value === preference;
        const label = mode.value === 'system'
          ? `System (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`
          : mode.label;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`theme-toggle__button${isActive ? ' is-active' : ''}`}
            onClick={() => handleSelect(mode.value)}
          >
            <span className="theme-toggle__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
