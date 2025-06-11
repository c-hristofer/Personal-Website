import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Nav from './components/nav';
import HomePage from './components/home-page';
import MLProjects from './components/ml-projects';
import SmallerProjects from './components/smaller-projects';
import Projects from './components/web-design-projects';
import Reccomendations from './components/reccomendations';
import WorkRelated from './components/work-related';
import RockPaperScissors from './components/rock-paper-scissors'
import FellowshipInformation from './components/fellowship-information'
import FlightPath from './components/flightpath';
import CybersecurityProject from './components/cybersecurity-project';
import './styles/style.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Nav />
        <div className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ml-projects" element={<MLProjects />} />
            <Route path="/smaller-projects" element={<SmallerProjects />} />
            <Route path="/web-design-projects" element={<Projects />} />
            <Route path="/reccomendations" element={<Reccomendations />} />
            <Route path="/work-related" element={<WorkRelated />} />
            <Route path="/rock-paper-scissors" element={<RockPaperScissors />} />
            <Route path="/fellowship-information" element={<FellowshipInformation />} />
            <Route path="/flightpath" element={<FlightPath />} />
            <Route path="/cybersecurity-project" element={<CybersecurityProject />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;