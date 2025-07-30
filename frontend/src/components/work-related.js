import '../styles/style.css';

function WorkRelated() {
  return (
    <>

      <main>
        <br />
        <h1>Work Related</h1>
        <p>Here are some highlights of my career, feel free to click on anything to learn more.</p>
        <p>
          <a className="main-card" href="../docs/Christofer_Piedra_CV.pdf" target="_blank" rel="noopener noreferrer">
            <strong>CV</strong>
          </a>
        </p>

        <p>
          <a className="main-card" href="/reccomendations">
            <strong>Reccomendations</strong>
          </a>
        </p>

        <p>
          <a className="main-card" href="https://www.github.com/c-hristofer" target="_blank" rel="noopener noreferrer">
            <strong>Github Profile</strong>
          </a>
        </p>

        <p>
          <a className="main-card" href="https://www.leetcode.com/u/c_hristofer/" target="_blank" rel="noopener noreferrer">
            <strong>Leetcode Profile</strong>
          </a>
        </p>
      </main>
    </>
  );
}

export default WorkRelated;