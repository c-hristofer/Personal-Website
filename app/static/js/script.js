// script.js
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navFrame   = document.getElementById('nav-frame');
    
    // When hamburger is clicked: toggle the iframe open, toggle nav inside
    menuToggle.addEventListener('click', () => {
      navFrame.classList.toggle('open');
      navFrame.contentWindow.postMessage('toggle-menu', '*');
    });
  
    // Listen for "close-menu" from the iframe
    window.addEventListener('message', (event) => {
      if (event.data === 'close-menu') {
        // 1) Hide the iframe
        navFrame.classList.remove('open');
        // 2) Also toggle the nav inside again, so it's set back to hidden
        navFrame.contentWindow.postMessage('toggle-menu', '*');
      }
    });
  });