import React, { useState } from 'react';
import '../styles/style.css';

function RockPaperScissors() {
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ties, setTies] = useState(0);

  const handlePick = (choice) => {
    const randomNumber = Math.random();

    if (choice === 'rock') {
      if (randomNumber <= 1 / 3) {
        console.log('You picked rock. Computer picked rock. You tied.');
        setTies((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        console.log('You picked rock. Computer picked paper. You lost :(');
        setLosses((prev) => prev + 1);
      } else {
        console.log('You picked rock. Computer picked scissors. Rock beats scissors!');
        setWins((prev) => prev + 1);
      }
    } else if (choice === 'paper') {
      if (randomNumber <= 1 / 3) {
        console.log('You picked paper. Computer picked rock. Paper beats rock!');
        setWins((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        console.log('You picked paper. Computer picked paper. You tied.');
        setTies((prev) => prev + 1);
      } else {
        console.log('You picked paper. Computer picked scissors. You lost :(');
        setLosses((prev) => prev + 1);
      }
    } else if (choice === 'scissors') {
      if (randomNumber <= 1 / 3) {
        console.log('You picked scissors. Computer picked rock. You lost :(');
        setLosses((prev) => prev + 1);
      } else if (randomNumber <= 2 / 3) {
        console.log('You picked scissors. Computer picked paper. Scissors beat paper!');
        setWins((prev) => prev + 1);
      } else {
        console.log('You picked scissors. Computer picked scissors. You tied.');
        setTies((prev) => prev + 1);
      }
    }

    console.log(`Wins: ${wins + (choice === 'rock' && randomNumber > 2/3) + (choice === 'paper' && randomNumber <= 1/3) + (choice === 'scissors' && randomNumber > 1/3 && randomNumber <= 2/3)}
Losses: ${losses + (choice === 'rock' && randomNumber > 1/3 && randomNumber <= 2/3) + (choice === 'paper' && randomNumber > 2/3) + (choice === 'scissors' && randomNumber <= 1/3)}
Ties: ${ties + (randomNumber <= 1/3 && choice === 'rock') + (randomNumber > 1/3 && randomNumber <= 2/3 && choice === 'paper') + (randomNumber > 2/3 && choice === 'scissors')}`);
  };

  const resetScore = () => {
    setWins(0);
    setLosses(0);
    setTies(0);
    console.log(`Wins: 0\nLosses: 0\nTies: 0`);
  };

  return (
    <>
      <main>
        <h1>Rock Paper Scissors</h1>
        <div className="rps-buttons">
          <button onClick={() => handlePick('rock')}>Rock</button>
          <button onClick={() => handlePick('paper')}>Paper</button>
          <button onClick={() => handlePick('scissors')}>Scissors</button>
        </div>

        <div className="score-buttons">
          <button onClick={resetScore}>Reset Score</button>
        </div>
      </main>
    </>
  );
}

export default RockPaperScissors;