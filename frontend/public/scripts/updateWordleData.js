
const fs = require('fs');
const path = require('path');
const https = require('https');

// Output directory
const outputDir = path.join(__dirname, '..', 'docs', 'wordle');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// URLs
const pastAnswersURL = 'https://www.nytimes.com/svc/wordle/v2/2024-12-31.json';
const possibleGuessesURL = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words';

// Function to fetch data from a URL
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}


// Function to extract past answers
async function updatePastAnswers() {
  try {
    const today = new Date();
    const promises = [];

    // Start at Wordle 0: 2021-06-19
    const startDate = new Date('2021-06-19');
    let currentDate = new Date(startDate);

    while (currentDate <= today) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      const url = `https://www.nytimes.com/svc/wordle/v2/${dateString}.json`;

      promises.push(fetchData(url).then(json => {
        const parsed = JSON.parse(json);
        return parsed.solution;
      }).catch(() => null));

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const answers = (await Promise.all(promises)).filter(Boolean);
    fs.writeFileSync(path.join(outputDir, 'past_answers.txt'), answers.join('\n'));
    console.log('past_answers.txt updated.');
  } catch (err) {
    console.error('Error updating past answers:', err);
  }
}

// Function to save possible guesses
async function updatePossibleGuesses() {
  try {
    const guesses = await fetchData(possibleGuessesURL);
    fs.writeFileSync(path.join(outputDir, 'possible_guesses.txt'), guesses);
    console.log('possible_guesses.txt updated.');
  } catch (err) {
    console.error('Error updating possible guesses:', err);
  }
}

// Main execution
(async () => {
  await updatePastAnswers();
  await updatePossibleGuesses();
})();