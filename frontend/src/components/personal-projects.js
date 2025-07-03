import '../styles/style.css';

function PersonalProjects() {
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
            <strong>Rock Paper Scissors Game</strong>
          </a>
        </div>

        <div>
          <a href="/calculator" className="main-card">
            <strong>Calculator App</strong>
          </a>
        </div>

        <div>
          <a href="/coin-flip" className="main-card">
            <strong>Coin Flip</strong>
          </a>
        </div>
      </main>
    </>
  );
}

export default PersonalProjects;