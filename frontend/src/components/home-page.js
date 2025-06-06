import React from 'react'
import '../styles/style.css'

function HomePage() {
  return (
    <>

      <main>
        <br />
        <h1>Welcome to My Website</h1>
        <p>
          Hello, my name is Christofer Piedra and welcome to my personal website!
          <br />
          <br />
          I will be updating this website over time with a bunch of cool things that will tell you more about what I do professionally and what kinds of projects I'm interested in.
        </p>
        <img
          className="profile-image"
          src="./images/christofer.jpeg"
          alt="Photo of me"
        />

        <div>
          <h2>Main pages so far are:</h2>

          <a href="/flightpath" className="main-card">
            FlightPath (Social Media Platform)
          </a>

          <a href="/fellowship-information" className="main-card">
            Summer Undergraduate Research Fellowship 2024
          </a>

          <a href="../docs/christofer-piedra-cv.pdf" target="_blank" rel="noopener noreferrer" className="main-card">
            Full CV
          </a>
        </div>
      </main>
    </>
  );
}

export default HomePage;