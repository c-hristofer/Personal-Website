import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/style.css';

function NotFound() {
  return (
    <div className="not-found-container">
      <h1 className="not-found-title">That Page Doesn't Exist</h1>

      <Link to="/" className="not-found-link">
        Go back to Home
      </Link>
    </div>
  );
}

export default NotFound;