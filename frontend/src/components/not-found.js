import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/style.css';

function NotFound() {
  return (
    <div className="not-found-container">
      <h1 className="not-found-title">404</h1>
      <img
        src="../public/images/not-found.png"
        alt="404 Not Found"
        className="not-found-image"
      />
      <Link to="/" className="not-found-link">
        Go back to Home
      </Link>
    </div>
  );
}

export default NotFound;