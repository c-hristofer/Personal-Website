import React from 'react';
import { useState } from 'react';
import '../styles/style.css';

function Flightpath() {
  const [showToc, setShowToc] = useState(false);
  return (
    <>
      <main>
        <button
          className="toc-toggle-btn"
          onClick={() => setShowToc(prev => !prev)}
        >
          {showToc ? 'Hide Table of Contents' : 'Show Table of Contents'}
        </button>
        {showToc && (
          <div className="toc-popup">
            <ul className="toc">
              <li><a name="toc-items" href="#login-page">1. Login Page</a></li>
              <li><a name="toc-items" href="#forgot-password-page">2. Forgot Password Page</a></li>
              <li><a name="toc-items" href="#student-account-creation">3A. Student Account Creation</a></li>
              <li><a name="toc-items" href="#student-profile">3B. Student Profile</a></li>
              <li><a name="toc-items" href="#student-account-settings">3C. Student Account Settings</a></li>
              <li><a name="toc-items" href="#resume-generation">3D. Resume Generation Screen</a></li>
              <li><a name="toc-items" href="#business-account-creation">4A. Business Account Creation</a></li>
              <li><a name="toc-items" href="#business-profile">4B. Business Profile Page</a></li>
              <li><a name="toc-items" href="#business-account-settings">4C. Business Account Settings</a></li>
              <li><a name="toc-items" href="#home-page-posts">5. Home Page with Posts</a></li>
              <li><a name="toc-items" href="#clubs-events-groups">6. Clubs, Events & Groups Page</a></li>
              <li><a name="toc-items" href="#messaging-page">7. Messaging Page</a></li>
              <li><a name="toc-items" href="#create-new-posts">8. Create New / New Posts Page</a></li>
              <li><a name="toc-items" href="#notifications-page">9. Notifications Page</a></li>
              <li><a name="toc-items" href="#search-bar">10. Search Bar</a></li>
              <li><a name="toc-items" href="#future-roadmap">Future Roadmap</a></li>
            </ul>
            <button className="toc-close-btn" onClick={() => setShowToc(false)}>×</button>
          </div>
        )}
        <section id="intro-pgh" className="flightpath-section">
          <h1>FlightPath</h1>
          <p>FlightPath is my Senior Design Project (August–December 2025) at FAU, where I serve as Team Lead. We’re building a full-stack web application to connect students, faculty, and local businesses. Although the official timeline runs from August to December 2025, I’m getting an early head start to ensure a solid foundation. We are currently using Firebase for our database; after the fall semester starts, we plan to migrate everything to AWS (DynamoDB, S3, Cognito).</p>
        </section>

        <section id="login-page" className='flightpath-section'>
          <h2>1. Login Page</h2>

          <p>
          <img
          className="display-image"
          src="./images/flightpath/1.png"
          alt="Photo of Login Page"
          />
          <br />
          When a user navigates to FlightPath, they first see this Login Page. The form is centered inside a card with the FAU owl logo and top navigation bar. Students or businesses can enter their email/username and password to sign in. Key features already implemented with Firebase Authentication:</p>
          <ul>
            <li>Responsive layout with a centered form card.</li>
            <li>Email/password login using Firebase Auth.</li>
            <li>Links to “Forgot Password” and “Sign Up” pages.</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>University SSO integration (FAU OAuth2) for direct campus login.</li>
            <li>Social login buttons (e.g., Google SSO).</li>
            <li>Client-side error handling for invalid credentials and locked accounts.</li>
          </ul>
        </section>

        <section id="forgot-password-page" className="flightpath-section">
          <h2>2. Forgot Password Page</h2>

          <p>
          <img
          className="display-image"
          src="./images/flightpath/2.png"
          alt="Photo of Forgot Password Page"
          />
          <br />
          If a user forgets their password, they click “Forgot Password” and see this page. It contains a single input for the user’s email and a “Send Reset Email” button. We’ve connected this to Firebase’s <code>sendPasswordResetEmail(...)</code> method.</p>
          <p>Work still in progress:</p>
          <ul>
            <li>Display a confirmation message or redirect after the reset email is sent.</li>
            <li>Client-side validation (ensure proper email format).</li>
            <li>Rate-limiting or CAPTCHA to prevent abuse.</li>
          </ul>
        </section>

        <section id="student-account-creation" className='flightpath-section'>
          <h2>3A. Student Account Creation</h2>

          <p>
          <img
          className="display-image"
          src="./images/flightpath/3A.png"
          alt="Photo of Student Account Creation Page"
          />
          <br />
          New students create an account with this form. Eventually, we will use FAU SSO to auto-import student details. For now, it is a standard form that writes to Firestore under <code>users/students/{'{uid}'}</code>. Fields include:</p>
          <ul>
            <li>Email, Password, Confirm Password</li>
            <li>Student Name (auto-import placeholder for FAU SSO)</li>
            <li>Phone Number, About/Bio, Profile Image, Banner Image</li>
            <li>City, State dropdowns</li>
            <li>Links input (multiple URLs)</li>
            <li>College of Enrollment checkboxes (FAU colleges)</li>
            <li>Degrees, Graduation Year, Courses Taken (dynamic “+ Add” lists)</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>FAU SSO integration so the form auto-populates name, email, major.</li>
            <li>Real-time Firestore writes on “Create Account.”</li>
            <li>Error handling for duplicate emails or invalid inputs.</li>
            <li>Progressive disclosure to hide optional fields until later.</li>
          </ul>
        </section>

        <section id="student-profile" className='flightpath-section'>
          <h2>3B. Student Profile</h2>

          <p>
          <img
          className="display-image"
          src="./images/flightpath/3B.png"
          alt="Photo of Student Profile Page"
          />
          <br />
          After signing in, students land on their Profile Page. All data is pulled in real time from Firestore under <code>users/students/{'{uid}'}</code> and related subcollections. Displayed information includes:</p>
          <ul>
            <li>Header banner and avatar image uploaded to Firebase Storage.</li>
            <li>Name, education summary, campus, location, email, joined date.</li>
            <li><strong>Create Resume</strong> button (opens Resume Generation screen).</li>
            <li>About section (editable short bio).</li>
            <li>Experience section with cards for each job/internship.</li>
            <li>Education section listing degrees, majors, minors, colleges.</li>
            <li>Skills section (each skill displayed as a pill).</li>
            <li>Links section (URLs displayed as clickable chips).</li>
            <li>Courses taken (displayed as pills).</li>
            <li><strong>Sign Out</strong> button at the bottom.</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Improve layout for long lists (horizontal scrolling or collapsible lists for skills/links).</li>
            <li>Add “Edit” buttons for each section to open a modal or inline editor.</li>
            <li>Implement <strong>Followers/Following</strong> pages so students can network.</li>
          </ul>
        </section>

        <section id="student-account-settings" className='flightpath-section'>
          <h2>3C. Student Account Settings</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/3C.png"
          alt="Photo of Student Account Settings Page"
          />
          <br />
          Students can update all personal details here, with fields pre-populated from Firestore. Features include:</p>
          <ul>
            <li>First Name, Last Name, Phone Number, Email (with “Change Email” flow).</li>
            <li>Password update (behind a “Change Password” button).</li>
            <li>Avatar & Banner image file inputs (uploads to Firebase Storage).</li>
            <li>City & State dropdowns (writes back to Firestore on “Save Changes”).</li>
            <li>Account Visibility toggle (Public vs. Private).</li>
            <li><strong>Switch to Private Account</strong>, <strong>Save Changes</strong>, and <strong>Delete Account</strong> buttons.</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Implement Firebase re-authentication flow for updating email/password.</li>
            <li>Deletion flow must cascade remove all <code>users/students/{'{uid}'}</code> documents and subcollections.</li>
            <li>Support for <strong>Professor & Admin</strong> roles to manage student profiles.</li>
            <li>Add settings for <strong>Followers/Following</strong> (e.g., “Allow others to follow me”).</li>
          </ul>
        </section>

        <section id="resume-generation" className='flightpath-section'>
          <h2>3D. Resume Generation Screen</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/3D.png"
          alt="Photo of Resume Generation Page"
          />
          <br />
          <div className="scrollable-container">
            <iframe
              className="scrollable-image"
              src="./docs/example-resume.pdf"
              title="Current Format of Resume Output"
            />
          </div>
          <br />
          
          Students select which sections to include in a downloadable resume. All data (Skills, Experience, Education) is pulled from Firestore. Features so far:</p>
          <ul>
            <li>Section toggles: <strong>Education</strong>, <strong>Experience</strong>, <strong>Skills</strong>.</li>
            <li><strong>Export to Word</strong> button generates a <code>.docx</code> file using a Node.js function (proof-of-concept attached as <code>Resume.docx</code>).</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Apply proper formatting: bold headings, bullet lists, consistent fonts/sizes in the <code>.docx</code>.</li>
            <li>Add additional toggles for <strong>Projects</strong>, <strong>Honors & Awards</strong>, <strong>Certifications</strong>.</li>
            <li>Create a <strong>PDF export</strong> option with styled layout.</li>
            <li>Implement a <strong>live preview</strong> so students can see formatted resume before downloading.</li>
          </ul>
        </section>

        <section id="business-account-creation" className='flightpath-section'>
          <h2>4A. Business Account Creation</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/4A.png"
          alt="Photo of Business Account Creation Page"
          />
          <br />
          Businesses sign up with a similar form, writing to Firestore under <code>users/businesses/{'{uid}'}</code>. Current fields include:</p>
          <ul>
            <li>Email, Password, Confirm Password.</li>
            <li>Business Name (required).</li>
            <li>Phone Number, About, Profile Image, Banner Image.</li>
            <li>City & State dropdowns.</li>
            <li>Links input (multiple URLs).</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Validation to ensure <strong>Business Name</strong> is unique.</li>
            <li>Add <strong>Industry</strong> dropdown (e.g., Technology, Retail, Healthcare).</li>
            <li>Support <strong>Multiple Administrators</strong> per business account.</li>
          </ul>
        </section>

        <section id="business-profile" className='flightpath-section'>
          <h2>4B. Business Profile Page</h2>
          <p>
          <img
          className="display-image"
          src="./images/flightpath/4B.png"
          alt="Photo of Business Profile Page"
          />
          <br />
          Once signed in, a business sees a streamlined profile card with data pulled from Firestore:</p>
          <ul>
            <li>Banner & avatar (default if none uploaded).</li>
            <li>Business Name, Location, Email, Joined Date.</li>
            <li><strong>Create Resume</strong> button placeholder (will be replaced with “Post Job” in the future).</li>
            <li>About section, <strong>Links</strong> section.</li>
            <li><strong>Sign Out</strong> button at the bottom.</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Replace “Create Resume” with a <strong>“Post a Job”</strong> button linking to a job-creation form.</li>
            <li>Display <strong>Job Listings</strong> created by this business (from <code>jobs</code> collection).</li>
            <li>Build a <strong>Business Insights</strong> dashboard for application metrics.</li>
          </ul>
        </section>

        <section id="business-account-settings" className='flightpath-section'>
          <h2>4C. Business Account Settings</h2>
          <p>
          <img
          className="display-image"
          src="./images/flightpath/4C.png"
          alt="Photo of Business Account Settings Page"
          />
          <br />
          Businesses can edit their profile details here, pulling data from Firestore:</p>
          <ul>
            <li>Business Name, Phone Number, Email (with “Edit Email” flow).</li>
            <li>Change Password button (handled via Firebase Auth).</li>
            <li>Avatar & Banner Image file inputs (upload to Firebase Storage).</li>
            <li>City, State, Account Visibility toggle.</li>
            <li><strong>Switch to Private Account</strong>, <strong>Save Changes</strong>, and <strong>Delete Account</strong>.</li>
          </ul>
          <p>Work still in progress:</p>
          <ul>
            <li>Add <strong>Industry</strong> selection once field is available.</li>
            <li>Rich-text editor for the <strong>About</strong> section (formatting, bullet points).</li>
            <li>Allow multiple <strong>Administrators</strong> to manage a business account.</li>
          </ul>
        </section>

        <section id="home-page-posts" className='flightpath-section'>
          <h2>5. Home Page with Posts</h2>
        
          <p>
          <img
          className="display-image"
          src="./images/flightpath/5.png"
          alt="Photo of Home Page"
          />
          <br />
          The “Home” tab displays a feed of posts from Firestore (<code>posts</code> collection). Each post card shows:</p>
          <ul>
            <li>Poster’s avatar & name (currently hardcoded as “MattWhite” in the screenshot).</li>
            <li>Banner image (e.g., FAU campus photo).</li>
            <li>Post text content.</li>
            <li>Post footer with timestamp, like/comment/repost/share icons, and counts (e.g., “0 likes · 1 comment · 0 reposts”).</li>
          </ul>
          <p>Like, comment, repost, and share functionality is already built in using Firestore subcollections (<code>posts/{'{postId}'}/likes</code>, <code>comments</code>, etc.) and real-time listeners.</p>
          <p>Work still in progress:</p>
          <ul>
            <li>Fetch actual <strong>Job</strong> postings from <code>jobs</code> in Firestore instead of hardcoded cards on the right. Potentially refactor Jobs into its own page.</li>
            <li>Implement <strong>infinite scroll</strong> or pagination for large numbers of posts.</li>
            <li>Add <strong>post filters</strong> (Newest, Most Liked, Clubs, Jobs, Announcements).</li>
            <li>Enable <strong>user mentions</strong> (e.g., @AliceNguyen) and <strong>hashtags</strong> (#FAULab).</li>
          </ul>
        </section>

        <section id="clubs-events-groups" className='flightpath-section'>
          <h2>6. Clubs, Events & Groups Page</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/6.png"
          alt="Photo of Clubs, Events, & Groups Page"
          />
          <br />
          Under the “Network” tab, this page shows cards for various clubs, events, and groups. Each card contains:</p>
          <ul>
            <li>Title (e.g., “Cybersecurity Lab Meeting”).</li>
            <li>Description text for what the club/event does.</li>
            <li>Grey info box with date, time, recurrence, location, and attendee/member count.</li>
            <li>“Join” button on group pages.</li>
          </ul>
          <p>Current implementation uses hardcoded data. Planned work:</p>
          <ul>
            <li>Move to a Firestore <code>events</code> or <code>groups</code> collection with fields <code>title, description, date, time, recurrence, location, attendeesCount</code>.</li>
            <li>Real-time listeners to populate UI from Firestore data.</li>
            <li>“Join/Leave” logic that writes to <code>events/{'{eventId}'}/attendees/{'{userUid}'}</code> and updates the attendee count.</li>
            <li>RSVP notifications via Firebase Cloud Messaging (later AWS SNS).</li>
            <li>Event creation flow linking from Screen 8.</li>
          </ul>
        </section>

        <section id="messaging-page" className='flightpath-section'>
          <h2>7. Messaging Page</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/7.png"
          alt="Photo of Messaging Page"
          />
          <br />
          Under the “Messaging” tab, we have a two-column chat interface:</p>
          <ul>
            <li><strong>Left column</strong>: lists recent conversations (e.g., James Varol, Alexis Dominic), showing avatar, last message snippet, and relative timestamp.</li>
            <li><strong>Right column</strong>: displays the selected conversation with message bubbles and timestamps. Input bar at bottom for new messages (emoji, attachments, send icon).</li>
          </ul>
          <p>Current data is static/mock. Planned work:</p>
          <ul>
            <li>Connect to Firestore <code>chats/{'{chatId}'}/messages/{'{messageId}'}</code> subcollections (fields: <code>senderUid, text, timestamp, isRead</code>).</li>
            <li>Real-time <code>onSnapshot()</code> so new messages appear live.</li>
            <li>Typing indicators and presence (online/offline) using Firestore or Realtime Database.</li>
            <li>Requests tab: show pending chat invites when a user messages another for the first time.</li>
            <li>Push notifications for new messages (Firebase Cloud Messaging now, AWS SNS later).</li>
            <li>Group chat support for multi-user conversations.</li>
          </ul>
        </section>

        <section id="create-new-posts" className='flightpath-section'>
          <h2>8. Create New / New Posts Page</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/8.png"
          alt="Photo of New Posts Page"
          />
          <br />
          Under the “Create” tab, users see three large cards:</p>
          <ul>
            <li><strong>New Post</strong> – opens a form to compose a text/image/video post.</li>
            <li><strong>New Job</strong> – opens a job posting form (title, description, location, salary, deadline).</li>
            <li><strong>New Event/Group</strong> – opens event creation form (title, description, date/time, recurrence, location, capacity).</li>
          </ul>
          <p>Current implementation is front-end only. Planned work:</p>
          <ul>
            <li>Write new <strong>posts</strong> to Firestore <code>posts/{'{newPostId}'}</code> with fields <code>authorUid, content, mediaUrl, createdAt</code>.</li>
            <li>Write new <strong>jobs</strong> to Firestore <code>jobs/{'{newJobId}'}</code> with fields <code>title, description, companyUid, location, stipend, deadline, createdAt</code>.</li>
            <li>Write new <strong>events</strong> to Firestore <code>events/{'{newEventId}'}</code> with fields <code>title, description, date, time, recurrence, location, createdAt</code>.</li>
            <li>Form validation with error handling (required fields, correct formats).</li>
            <li>Associate each new item with <code>createdBy: currentUserUid</code> for permissions (edit/delete).</li>
            <li>File uploads to Firebase Storage (later AWS S3) for media attachments.</li>
            <li>Rich text editor for post content instead of plain <code>&lt;textarea&gt;</code>.</li>
          </ul>
        </section>

        <section id="notifications-page" className='flightpath-section'>
          <h2>9. Notifications Page</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/9.png"
          alt="Photo of Notifications Page"
          />
          <br />
          Under the “Notifications” tab, users see a list of notifications with icons and timestamps:</p>
          <ul>
            <li><strong>Like</strong> (red heart icon) – e.g., “Intracoastal Brewing Co. liked your post”</li>
            <li><strong>Comment</strong> (green chat bubble icon) – e.g., “Alice Nguyen commented on your post”</li>
            <li><strong>New Follower</strong> (blue person-add icon) – e.g., “Behnaz Ghoraani started following you”</li>
            <li><strong>Event Reminder</strong> (blue calendar icon) – e.g., “Cybersecurity Lab Meeting starts in 30 minutes”</li>
            <li><strong>System Alert</strong> (yellow bell icon) – e.g., “System maintenance scheduled April 25, 2025 at 2:00 AM”</li>
            <li><strong>Security Warning</strong> (red exclamation icon) – e.g., “Your password will expire in 3 days”</li>
          </ul>
          <p>Current data is static/mock. Planned work:</p>
          <ul>
            <li>Connect to Firestore <code>notifications/{'{userUid}'}/{'{notificationId}'}</code> collection with fields <code>type, content, iconType, timestamp, metadata</code>.</li>
            <li>Real-time <code>onSnapshot()</code> to fetch new notifications as they arrive.</li>
            <li>Make each notification <strong>clickable</strong> to navigate to related content (post, event, profile).</li>
            <li>“Mark as read” or delete notifications, updating <code>isRead</code> in Firestore.</li>
            <li>Pagination or “load more” for long notification lists.</li>
          </ul>
        </section>

        <section id="search-bar" className='flightpath-section'>
          <h2>10. Search Bar</h2>
          
          <p>
          <img
          className="display-image"
          src="./images/flightpath/10.png"
          alt="Photo of Search Bar"
          />
          <br />
          The search input at the top allows users to type queries (e.g., “Hello”) and shows a dropdown with:</p>
          <ul>
            <li>Category filters as clickable pills: <strong>Jobs, Courses, Skills, Professors, Students</strong>.</li>
            <li>Live result list showing placeholder results (“Search Result #1 for ‘Hello’,” etc.).</li>
          </ul>
          <p>Current implementation is front-end only. Planned work:</p>
          <ul>
            <li>Connect to a search index—initially Firestore, later AWS OpenSearch or DynamoDB Global Secondary Indexes.</li>
            <li>Implement full-text search for partial keyword matches and ranking (e.g., “sec” returns “Cybersecurity Lab Meeting”).</li>
            <li>Debounce input (300ms delay) to avoid excessive backend queries.</li>
            <li>Category-specific queries: search only <code>users</code> where <code>role == "professor"</code> for “Professors,” etc.</li>
            <li>Result highlighting and auto-complete suggestions.</li>
            <li>Mobile responsiveness: collapse category pills into a dropdown and show results in a full-screen modal.</li>
          </ul>
        </section>

        <section id="future-roadmap" className='flightpath-section'>
          <h2>Future Roadmap</h2>
          <p>Between now and August 2025, our main goals are:</p>
          <ul>
            <li>Finalize Firestore → AWS migration plan (mapping collections to DynamoDB, S3, Cognito).</li>
            <li>Refactor Firebase Cloud Functions into AWS Lambdas (resume export, notifications, chat events).</li>
            <li>Ensure each UI screen (1–10) is fully CRUD-connected to Firebase before switching to AWS.</li>
            <li>Add <strong>Followers/Following</strong> pages for all account types (student, business, professor, admin).</li>
            <li>Testing & QA: unit tests and end-to-end tests for sign-up, posting, chatting, notifications, search.</li>
          </ul>
          <p>By December 2025, we aim to have FlightPath fully deployed on AWS: React front-end hosted on S3/CloudFront, DynamoDB for data, Cognito for auth, and Lambda functions powering business logic. This will give FAU students, faculty, and local businesses a robust platform to network, collaborate, and grow their careers.</p>
        </section>
      </main>
    </>
  );
}

export default Flightpath;