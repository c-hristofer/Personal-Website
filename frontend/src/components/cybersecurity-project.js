import React from 'react';
import '../styles/style.css';

function CybersecurityProject() {
  return (
    <>

      <main>
        <h1>Cybersecurity Research & Projects</h1>
        <p>
          Over the past year, I have been engaged in developing and refining intrusion detection techniques using Zeek scripts as part of FAU’s Tecore Research Lab. My work focuses on detecting common network attacks—such as ARP poisoning, DDoS, and port scans—within IoT environments, optimizing detection thresholds, and reducing false positives. Collaborating with Dr. Imad Mahgoub and the research team, I have contributed to real-time alerting, log analysis, and automated reporting of anomalous network behavior.
        </p>
        <p>
          For a detailed overview of my fellowship and ongoing cybersecurity research, please visit the links below:
          <br />
          <a href="/fellowship-information" className="main-card">
            Summer Undergraduate Research Fellowship 2024
          </a>
        </p>
      </main>
    </>
  );
}

export default CybersecurityProject;