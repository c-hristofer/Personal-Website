import React from 'react';
import '../styles/style.css';

function FellowshipInformation() {
  return (
    <>

      <main>
        <br />
        <h1>Summer Undergraduate Research Fellowship 2024
        </h1>
        <img
            className="profile-image"
            src="./images/surf-showcase.jpeg"
            alt="Photo of me at SURF Showcase"
        />
        <p>
        During Summer 2024, I was selected for the Summer Undergraduate Research Fellowship (SURF) at Florida Atlantic University through the Office of Undergraduate Research and Inquiry (OURI). Under the mentorship of Dr. Imad Mahgoub in the FAU Tecore Lab, I conducted applied research in network security, focusing on real-time detection of common cyberattacks using Zeek, an open-source intrusion detection system.
        </p>

        <p><strong>
        A journal paper based on my ongoing research on this topic is currently under review.
        </strong></p>

        <p>
        My project, titled "Security Enhancement of the FAU Tecore Lab Internet of Things (IoT) Testbed,” involved simulating various attack scenarios such as DDoS, port scans, and ARP poisoning within a controlled testbed environment. I developed and fine-tuned Zeek detection scripts that flagged malicious behavior based on custom heuristics and log analysis, enabling more effective security monitoring for IoT networks.
        </p>

        <p>
        As part of the fellowship, I:
        <ol>
            <li>1. Built a virtual testbed using FAU infrastructure to model real-world network traffic.</li>
            <li>2. Wrote custom Intrusion Detection System (IDS) scripts on Zeek to detect signature and behavior-based anomalies.</li>
            <li>3. Wrote scripts to automatically send attacks and benign traffic to the IDS.</li>
            <li>4. Collaborated with graduate researchers to align the system with long-term lab goals</li>
            <li>5. Presented my findings at the OURI Annual Summer Student Showcase.</li>
        </ol>
        </p>

        <p>
        <a className="main-card" href='https://www.instagram.com/p/C_3R9OKPjiw/' target="_blank" rel="noopener noreferrer">Click to see FAU’s Instagram post about my research</a> 
        <br />
        <a className="main-card" href='../docs/surf-showcase-outcomes.pdf' target="_blank" rel="noopener noreferrer">Click to download the full OURI Summer Showcase Outcomes PDF</a>
        </p>

        <p>
        This experience deepened my interest in cybersecurity and gave me firsthand experience in applied research and academic presentation. I plan to continue refining the detection system and contributing to future publications with the Tecore Lab team.
        </p>
      </main>
    </>
  );
}

export default FellowshipInformation;