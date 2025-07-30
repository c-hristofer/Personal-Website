import { useState } from 'react';
import '../styles/style.css';

function CoinFlip() {

    const [message, setImage] = useState('');

    const handlePick = (choice) => {
        const randomNumber = Math.round(Math.random());
        
        if (randomNumber == 1) {
            setImage( <img
                className="coin-image"
                src="./images/coin_flip/coin-heads.png"
                alt="Photo of Heads"
            />)
        }
        else {
            setImage( <img
                className="coin-image"
                src="./images/coin_flip/coin-tails.png"
                alt="Photo of Tails"
            />)
        }


    }


    return (
    <>
    
    

    <main>
        <br />
        <h1>Coin Flip</h1>
        
        <p>Just a simple coin flipper in case if ever need it.</p>

        <div className="rps-buttons">
            <button onClick={() => handlePick('rock')}>
            Flip Coin
            </button>
        </div>
        
        <p>{message}</p>
    </main>
    </>
  );
}

export default CoinFlip;