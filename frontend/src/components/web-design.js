import '../styles/style.css';

function WebDesign() {
  return (
    <>

      <main>
        <br />
        <h1>Web Design</h1>
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
          <a href="/to-do-signin" className="main-card">
            <strong>To-Do List</strong>
            <br />
            A secure reminder and recurring task dashboard that helps users manage daily and weekly responsibilities with Firebase-authenticated user accounts, collapsible views, past-due tracking, and real-time updates.
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

export default WebDesign;