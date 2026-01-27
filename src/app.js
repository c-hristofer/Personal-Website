import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Nav from './components/nav';
import HomePage from './components/home-page';
import AI from './components/ai';
import PersonalProjects from './components/personal-projects';
import WebDesign from './components/web-design';
import Reccomendations from './components/reccomendations';
import WorkRelated from './components/work-related';
import RockPaperScissors from './components/rock-paper-scissors'
import FellowshipInformation from './components/fellowship-information'
import FlightPath from './components/flightpath';
import Cybersecurity from './components/cybersecurity';
import AmazonClone from './components/amazon-clone';
import Calculator from './components/calculator';
import CoinFlip from './components/coin-flip';
import ToDo from './components/to-do';
import ToDoSignIn from './components/to-do-signin'
import WordleSolver from './components/wordle-solver'
import BasketballPredictor from './components/basketball-predictor'
import Makemore from './components/makemore'
import WorkoutHub from './components/workout/workout-hub';
import WorkoutSettings from './components/workout/workout-settings';
import WorkoutData from './components/workout/workout-data';

import './styles/style.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Nav />
        <div className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ai" element={<AI />} />
            <Route path="/personal-projects" element={<PersonalProjects />} />
            <Route path="/web-design" element={<WebDesign />} />
            <Route path="/reccomendations" element={<Reccomendations />} />
            <Route path="/work-related" element={<WorkRelated />} />
            <Route path="/rock-paper-scissors" element={<RockPaperScissors />} />
            <Route path="/fellowship-information" element={<FellowshipInformation />} />
            <Route path="/flightpath" element={<FlightPath />} />
            <Route path="/cybersecurity" element={<Cybersecurity />} />
            <Route path="/amazon-clone" element={<AmazonClone />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/coin-flip" element={<CoinFlip />} />
            <Route path="/to-do" element={<ToDo />} />
            <Route path="/to-do-signin" element={<ToDoSignIn />} />
            <Route path="/wordle-solver" element={<WordleSolver />} />
            <Route path="/basketball-predictor" element={<BasketballPredictor />} />
            <Route path="/makemore" element={<Makemore />} />
            <Route path="/projects/workout" element={<WorkoutHub />} />
            <Route path="/projects/workout/settings" element={<WorkoutSettings />} />
            <Route path="/projects/workout/data" element={<WorkoutData />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
