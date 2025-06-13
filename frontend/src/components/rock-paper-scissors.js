import { useState } from 'react';
import '../styles/style.css';

function RockPaperScissors() {
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ties, setTies] = useState(0);
  const [message, setMessage] = useState('');

  const handlePick = (choice) => {
    const randomNumber = Math.random();
    let roundMessage = '';

/*
Rock: 0 - 1/3
        ties: 0 - 1/3
        wins: 2/3 - 1
        loses: 1/3 - 2/3

Paper: 1/3 - 2/3
        ties: 1/3 - 2/3
        wins: 0 - 1/3
        loses: 2/3 - 1

Scissors: 2/3 - 1
        ties: 2/3 - 1
        wins: 1/3 - 2/3
        loses: 0 - 1/3
*/

    if (choice === 'rock') {
      if (randomNumber <= 1 / 3) {
        roundMessage = 'You picked rock. Computer picked rock. You tied.';
        setTies((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        roundMessage = 'You picked rock. Computer picked paper. You lost :(';
        setLosses((prev) => prev + 1);
      } else {
        roundMessage = 'You picked rock. Computer picked scissors. Rock beats scissors!';
        setWins((prev) => prev + 1);
      }
    } else if (choice === 'paper') {
      if (randomNumber <= 1 / 3) {
        roundMessage = 'You picked paper. Computer picked rock. Paper beats rock!';
        setWins((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        roundMessage = 'You picked paper. Computer picked paper. You tied.';
        setTies((prev) => prev + 1);
      } else {
        roundMessage = 'You picked paper. Computer picked scissors. You lost :(';
        setLosses((prev) => prev + 1);
      }
    } else if (choice === 'scissors') {
      if (randomNumber <= 1 / 3) {
        roundMessage = 'You picked scissors. Computer picked rock. You lost :(';
        setLosses((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        roundMessage = 'You picked scissors. Computer picked paper. Scissors beat paper!';
        setWins((prev) => prev + 1);
      } else {
        roundMessage = 'You picked scissors. Computer picked scissors. You tied.';
        setTies((prev) => prev + 1);
      }
    }

    const updatedWins =
      wins +
      (choice === 'rock' && randomNumber > 2 / 3 ? 1 : 0) +
      (choice === 'paper' && randomNumber <= 1 / 3 ? 1 : 0) +
      (choice === 'scissors' && randomNumber > 1 / 3 && randomNumber <= 2 / 3 ? 1 : 0);
    const updatedLosses =
      losses +
      (choice === 'rock' && randomNumber > 1 / 3 && randomNumber <= 2 / 3 ? 1 : 0) +
      (choice === 'paper' && randomNumber > 2 / 3 ? 1 : 0) +
      (choice === 'scissors' && randomNumber <= 1 / 3 ? 1 : 0);
    const updatedTies =
      ties +
      (randomNumber <= 1 / 3 && choice === 'rock' ? 1 : 0) +
      (randomNumber > 1 / 3 && randomNumber <= 2 / 3 && choice === 'paper' ? 1 : 0) +
      (randomNumber > 2 / 3 && choice === 'scissors' ? 1 : 0);

    setMessage(
      roundMessage +
        '\n' +
        `Wins: ${updatedWins}\nLosses: ${updatedLosses}\nTies: ${updatedTies}`
    );
}

  const resetScore = () => {
    setWins(0);
    setLosses(0);
    setTies(0);
    setMessage(``);
  };

  return (
    <>
      <main>
        <h1>Rock Paper Scissors</h1>
        <p>
            This is an easy implementation of Rock Paper Scissors using JavaScript. Make your selection and the webstie will tell you if you won or lost as well as what your overall score is.
        </p>
        <div className="rps-buttons">
          <button onClick={() => handlePick('rock')}>Rock</button>
          <button onClick={() => handlePick('paper')}>Paper</button>
          <button onClick={() => handlePick('scissors')}>Scissors</button>
        </div>

        <div className="score-buttons">
          <button onClick={resetScore}>Reset Score</button>
        </div>
        <div className="score-display">
          <p>Wins: {wins}</p>
          <p>Losses: {losses}</p>
          <p>Ties: {ties}</p>
          <p>{message.split('\n')[0]}</p>
        </div>
      </main>
    </>
  );
}

export default RockPaperScissors;