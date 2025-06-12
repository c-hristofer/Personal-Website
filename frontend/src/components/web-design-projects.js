import '../styles/style.css';

function WebDesignProjects() {
  return (
    <>

      <main>
        <br />
        <h1>Web Design Projects</h1>
        <p>
        This page showcases the web apps I’ve designed and developed, with a focus on functionality, user experience, and clean interface design. Each project highlights a unique solution to real-world problems, from student networking platforms like FlightPath to interactive tools used in my research group.
        </p>

        <div>
          <a href="/flightpath" className="main-card">
            <strong>FlightPath</strong>
            <br />
            A social media platform that helps university students connect with other students, professors, and businesses through job listings, clubs, events, messaging, and real-time updates, while also supporting career planning with tools like a resume builder.
          </a>
        </div>

        <div>
          <a href="/amazon-clone" className="main-card">
            <strong>Amazon Clone</strong>
            <br />
            An amazon.com clone with certain functionality and a mock chckout process.
          </a>
        </div>
      </main>
    </>
  );
}

export default WebDesignProjects;