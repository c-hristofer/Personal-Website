import '../styles/style.css';

function BasketballPredictor() {
  return (
    <main className="page-content basketball-section">
      <h1>Basketball Game Outcome Predictor</h1>

      <section>
        <h2>Project Overview</h2>
        <p>
          This project uses machine learning to predict the outcomes of NBA basketball games. By combining team stats, player stats, ELO ratings, and historical matchups, the model learns patterns to predict both the winning team and the confidence in that prediction.
        </p>
      </section>

      <section>
        <h2>Tools & Technologies Used</h2>
        <ul>
          <li>Python, Pandas, Scikit-learn</li>
          <li>TensorFlow / Keras for Neural Network</li>
          <li>RandomForestClassifier from scikit-learn</li>
          <li>Matplotlib & Seaborn for visualization</li>
          <li>Jupyter for EDA and modeling</li>
          <li>VS Code / Anaconda for development</li>
        </ul>
      </section>

      <section>
        <h2>What I’ve Accomplished</h2>
        <h3>Data Engineering</h3>
        <ul>
          <li>Merged multiple feature sets: matchup-level data, player statistics, team performance stats, ELO scores</li>
          <li>Filled missing values and ensured consistent formatting</li>
        </ul>

        <h3>Model Training</h3>
        <ul>
          <li>Trained a Random Forest and a Neural Network on historical game data</li>
          <li>Applied TimeSeriesSplit cross-validation to simulate real-world prediction behavior</li>
          <li>Used accuracy and confidence thresholds to evaluate prediction trustworthiness</li>
        </ul>
      </section>

      <section>
        <h2>Current Results</h2>

        <h3>Feature Importance (Random Forest)</h3>
        <img src="../images/basketball-predictor/feature-importance-random-forest.png" alt="Feature Importance" />

        <h3>Neural Network Accuracy</h3>
        <img src="../images/basketball-predictor/neural-network-accuracy-per-epoch.png" alt="NN Accuracy" />

        <h3>Random Forest Performance vs Complexity</h3>
        <img src="../images/basketball-predictor/ranfom-forest-time-series-split-cv-accuracy-vs-number-of-trees.png" alt="RF Tuning" />
      
      </section>

      <section>
        <h2>What’s Left To Do</h2>
        <ul>
          <li>Add confidence thresholds and abstain from predictions under 60%</li>
          <li>Build web-based dashboard for uploading data and viewing predictions</li>
          <li>Allow comparison of models live on test set</li>
          <li>Incorporate betting odds and simulate strategy against spread</li>
          <li>Experiment with other models (XGBoost, CatBoost, LSTM)</li>
        </ul>
      </section>

      <section>
        <h2>Final Thoughts</h2>
        <p>
          This project demonstrates how data-driven techniques can be used to understand and forecast sports outcomes. With continual iteration, this tool can become useful for fans, bettors, and analysts alike.
        </p>
      </section>
    </main>
  );
}

export default BasketballPredictor;