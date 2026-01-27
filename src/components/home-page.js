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
          <h2>Main projects so far are:</h2>

          <a href="/flightpath" className="main-card">
            FlightPath (Social Media Platform)
          </a>

          <a href="/fellowship-information" className="main-card">
            Summer Undergraduate Research Fellowship 2024
          </a>

          <a href="/basketball-predictor" target="_blank" rel="noopener noreferrer" className="main-card">
            Neural Net and Random Forest Basketball Predictor
          </a>

          <a href="/wordle-solver" target="_blank" rel="noopener noreferrer" className="main-card">
            Entropy-Based Wordle Solver
          </a>

          <a href="/projects/workout" className="main-card">
            Workout Planner &amp; Tracker
          </a>
        </div>
      </main>
    </>
  );
}

export default HomePage;
