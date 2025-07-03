import { useEffect, useState, useCallback } from 'react';
import '../styles/style.css';

// Load the word lists at runtime
const loadWords = async () => {
  const [guesses, answers] = await Promise.all([
    fetch('/docs/wordle/possible_guesses.txt').then(res => res.text()),
    fetch('/docs/wordle/past_answers.txt').then(res => res.text())
  ]);
  return {
    guesses: guesses.trim().split('\n').map(w => w.trim()),
    answers: answers.trim().split('\n').map(w => w.trim())
  };
};

// Compute feedback like Wordle
function getFeedback(guess, target) {
  const feedback = Array(5).fill("⬛");
  const targetLetters = target.split('');
  const used = Array(5).fill(false);

  // First pass: correct letters
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      feedback[i] = "🟩";
      used[i] = true;
    }
  }

  // Second pass: misplaced letters
  for (let i = 0; i < 5; i++) {
    if (feedback[i] === "🟩") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === target[j]) {
        feedback[i] = "🟨";
        used[j] = true;
        break;
      }
    }
  }

  return feedback;
}

// Entropy calculation (heuristic)
function entropy(word, candidates) {
  const patternCounts = {};
  for (const target of candidates) {
    const pattern = getFeedback(word, target).join('');
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  }
  const total = candidates.length;
  let ent = 0;
  for (const count of Object.values(patternCounts)) {
    const p = count / total;
    ent -= p * Math.log2(p);
  }
  return ent;
}

function WordleSolver() {
  const [mode, setMode] = useState(1);
  const [words, setWords] = useState({ guesses: [], answers: [] });

  // Mode 1 state
  const [guessIndex1, setGuessIndex1] = useState(0);
  const [suggested1, setSuggested1] = useState('');
  const [feedback1, setFeedback1] = useState([]);
  const [possible1, setPossible1] = useState([]);
  const [finished1, setFinished1] = useState(false);
  const [guesses1, setGuesses1] = useState([]);

  useEffect(() => {
    loadWords().then(setWords);
  }, []);

  useEffect(() => {
    if (mode === 1) {
      setSuggested1('salet');
      setGuessIndex1(1);
      setPossible1(words.answers);
      setFinished1(false);
      setFeedback1(["⬛", "⬛", "⬛", "⬛", "⬛"]);
      setGuesses1([]);
    }
  }, [mode, words]);
  // Mode 1: submit feedback, update state
  const submitFeedback1 = () => {
    if (feedback1.some(f => f !== "⬛" && f !== "🟨" && f !== "🟩")) return;
    console.log("Feedback for", suggested1, "->", feedback1.join(''));
    const filtered = possible1.filter(w => getFeedback(suggested1, w).join('') === feedback1.join(''));
    console.log("Remaining possible words:", filtered.length);
    setGuesses1(g => [...g, { guess: suggested1, feedback: [...feedback1] }]);
    if (feedback1.every(f => f === "🟩") || guessIndex1 >= 6) {
      setFinished1(true);
      return;
    }
    setPossible1(filtered);
    setGuessIndex1(g => g + 1);
    setSuggested1(() => {
      let best = filtered[0] || 'salet', max = -Infinity;
      const scored = [];
      for (const w of filtered) {
        const e = entropy(w, filtered);
        scored.push({ word: w, entropy: e });
        if (e > max) { max = e; best = w; }
      }
      scored.sort((a, b) => b.entropy - a.entropy);
      console.log("Top 5 entropy words:", scored.slice(0, 5));
      console.log("Next suggestion:", best);
      return best;
    });
    setFeedback1(["⬛", "⬛", "⬛", "⬛", "⬛"]);
  };

  const renderFeedbackControls = (fb, setFb) => (
    <div style={{ display: 'flex', gap: '0.5em' }}>
      {fb.map((f, i) => (
        <button key={i} onClick={() => {
          setFb(prev => {
            const copy = [...prev];
            copy[i] = copy[i] === "" ? "⬛" : copy[i] === "⬛" ? "🟨" : copy[i] === "🟨" ? "🟩" : "";
            return copy;
          });
        }} style={{
          width: "2rem", height: "2rem", fontSize: "1.2rem"
        }}>{f || "-"}</button>
      ))}
    </div>
  );

  const renderGuessGrid = (guesses) => {
    // guesses is array of { guess: string, feedback: array of 5 emojis }
    // Render 6 rows, each row 5 tiles
    // Map feedback emoji to class: 🟩=green, 🟨=yellow, ⬛=gray
    const feedbackClass = {
      "🟩": "green",
      "🟨": "yellow",
      "⬛": "gray",
      "": "gray"
    };
    const rows = [];
    // editable feedback row for current guess
    for (let i = 0; i < 6; i++) {
      if (i === guessIndex1 - 1 && !finished1) {
        const letters = suggested1.split('');
        const fb = feedback1;
        rows.push(
          <div key={i} className="guess-row">
            {letters.map((ch, idx) => (
              <div
                key={idx}
                className={`guess-tile ${feedbackClass[fb[idx]] || "gray"}`}
                onClick={() => {
                  const next = { "⬛": "🟨", "🟨": "🟩", "🟩": "⬛" };
                  setFeedback1(prev => {
                    const copy = [...prev];
                    copy[idx] = next[copy[idx] || "⬛"];
                    return copy;
                  });
                }}
                style={{ cursor: 'pointer' }}
              >
                {ch}
              </div>
            ))}
          </div>
        );
        continue;
      }
      // Normal row for filled guesses
      const entry = guesses[i];
      const letters = entry ? entry.guess.split('') : ['', '', '', '', ''];
      const fb = entry ? entry.feedback : ["", "", "", "", ""];
      rows.push(
        <div key={i} className="guess-row">
          {letters.map((ch, idx) => (
            <div key={idx} className={`guess-tile ${feedbackClass[fb[idx]] || "gray"}`}>
              {ch}
            </div>
          ))}
        </div>
      );
    }
    return <div className="guess-grid">{rows}</div>;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && mode === 1) {
        e.preventDefault();
        submitFeedback1();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, submitFeedback1]);

  return (
    <div className="dashboard">
      {mode === 1 && (
        <div className="solver-container">
          <h1>Wordle Solver</h1>
          <p><b>Guess #{guessIndex1}:</b> {suggested1}</p>
          {renderGuessGrid(guesses1)}
          <div className="button-group">
            <button onClick={submitFeedback1}>Submit Feedback</button>
            <button onClick={() => {
              setSuggested1('salet');
              setGuessIndex1(1);
              setPossible1(words.answers);
              setFinished1(false);
              setFeedback1(["⬛", "⬛", "⬛", "⬛", "⬛"]);
              setGuesses1([]);
            }}>Reset</button>
          </div>
          {finished1 && <p><b>Finished.</b></p>}
        </div>
      )}
    </div>
  );
}

export default WordleSolver;