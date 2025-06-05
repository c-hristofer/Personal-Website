import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Nav from './components/nav';
import HomePage from './components/home-page';
import MLProjects from './components/ml-projects';
import SmallerProjects from './components/smaller-projects';
import Projects from './components/web-design-projects';
import Reccomendations from './components/reccomendations';
import WorkRelated from './components/work-related';
import NotFound from './components/not-found';
import RockPaperScissors from './components/rock-paper-scissors'
import FellowshipInformation from './components/fellowship-information'
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;