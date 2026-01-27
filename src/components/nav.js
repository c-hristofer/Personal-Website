import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './theme-toggle';
import '../styles/style.css';

function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
    <header>
        <a href="/" aria-label="Home">
            <img src="/icons/logo.png" alt="Site logo" className="logo" />
        </a>
        <div className="header-actions">
          {/* Hamburger button (fixed at top‐right) */}
          <button
            className="menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
            aria-controls="primary-navigation"
            onClick={handleOpen}
          >
            <span className="menu-icon" aria-hidden="true">☰</span>
          </button>
        </div>
      </header>
      {/* Full‐screen nav overlay */}
      <nav
        id="primary-navigation"
        className={`nav-menu${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
      >
        <button className="close-btn" aria-label="Close navigation menu" onClick={handleClose}>
          ✕
        </button>
        <div className="nav-theme" role="region" aria-label="Theme selection">
          <p className="nav-theme__label">Appearance</p>
          <ThemeToggle />
        </div>
        <ul>
          <li><Link to="/" onClick={handleClose}>Home</Link></li>
          <li><Link to="/work-related" onClick={handleClose}>Work Related</Link></li>
          <li><Link to="/web-design" onClick={handleClose}>Web Design Projects</Link></li>
          <li><Link to="/cybersecurity" onClick={handleClose}>Cybersecurity Research</Link></li>
          <li><Link to="/ai" onClick={handleClose}>AI Projects</Link></li>
          <li><Link to="/personal-projects" onClick={handleClose}>Personal Projects</Link></li>
        </ul>
      </nav>
    </>
  );
}

export default Nav;
