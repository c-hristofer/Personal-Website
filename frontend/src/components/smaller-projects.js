import React from 'react';
import '../styles/style.css';

function SmallerProjects() {
  return (
    <>

      <main>
        <br />
        <h1>Smaller Projects</h1>
        <p>
            Below you will find the projects I've been making. They range from simple things like a calculator or to-do list, to complex things like a mock Amazon website. Have fun looking around!
        </p>

        <div>
          <a href="/rock-paper-scissors" className="main-card">
            <strong>Rock Paper Scissors</strong>
            <br />
            A game of Rock, Paper, Scissors using html, css, and inline JavaScript
          </a>
        </div>
      </main>
    </>
  );
}

export default SmallerProjects;