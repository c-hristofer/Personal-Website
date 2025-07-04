import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/style.css';

function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
    <header>
        <a href="/">
            <img src="./icons/logo.png" alt="Profile Image" className="logo" />
        </a>
    
    {/* Hamburger button (fixed at top‐right) */}
    <button
        className="menu-toggle"
        aria-label="Toggle navigation menu"
        onClick={handleOpen}
    >
        ☰
    </button>
      </header>
      {/* Full‐screen nav overlay */}
      <nav className={`nav-menu${isOpen ? ' open' : ''}`}>
        <button className="close-btn" aria-label="Close navigation menu" onClick={handleClose}>
          ✕
        </button>
        <ul>
          <li><Link to="/" onClick={handleClose}>Home</Link></li>
          <li><Link to="/work-related" onClick={handleClose}>Work Related</Link></li>
          <li><Link to="/web-design" onClick={handleClose}>Web Design</Link></li>
          <li><Link to="/cybersecurity" onClick={handleClose}>Cybersecurity</Link></li>
          <li><Link to="/ai" onClick={handleClose}>AI</Link></li>
          <li><Link to="/personal-projects" onClick={handleClose}>Personal Projects</Link></li>
        </ul>
      </nav>
    </>
  );
}

export default Nav;