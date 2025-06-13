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
          <li><Link to="/web-design-projects" onClick={handleClose}>Web Design Projects</Link></li>
          <li><Link to="/cybersecurity-project" onClick={handleClose}>Cybersecurity Project</Link></li>
          <li><Link to="/ml-projects" onClick={handleClose}>ML Projects</Link></li>
          <li><Link to="/smaller-projects" onClick={handleClose}>Smaller Projects</Link></li>
        </ul>
      </nav>
    </>
  );
}

export default Nav;