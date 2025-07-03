import '../styles/style.css';

function AI() {
  return (
    <>

      <main>
        <br />
        <h1>AI Projects</h1>
        <p>Here are the outcomes of my AI Projects. These projects can all be found in my github.
            <br />
            <br />
          My basketball predictor uses machine learning models like Random Forests and Neural Networks to forecast NBA game outcomes using team stats, ELO scores, and more. I'm also starting to work on a basic Generatively Pretrained Transformer (GPT) and the makemore character-level model.
        </p>
      </main>

      <a href="/basketball-predictor" className="main-card">
        Basketball Predictor
      </a>
    </>
  );
}

export default AI;