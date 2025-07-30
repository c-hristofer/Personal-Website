import React, { useState } from 'react';
import '../styles/style.css';

function MakemoreShowcase() {
  const [showToc, setShowToc] = useState(false);
  return (
    <>
      <button
        className="toc-toggle-btn"
        onClick={() => setShowToc(prev => !prev)}
      >
        {showToc ? 'Hide Table of Contents' : 'Show Table of Contents'}
      </button>
      {showToc && (
        <div className="toc-popup">
          <ul className="toc">
            <li><a href="#summary">Project Summary & Final Model</a></li>
            <li><a href="#iteration-1">Iteration 1: Bigram Model</a></li>
            <li><a href="#iteration-2">Iteration 2: MLP with Learned Embeddings</a></li>
            <li><a href="#iteration-3">Iteration 3: Deep MLP + BatchNorm</a></li>
            <li><a href="#iteration-4">Iteration 4: CNN</a></li>
          </ul>
          <button className="toc-close-btn" onClick={() => setShowToc(false)}>×</button>
        </div>
      )}
      <main>
        <div className="makemore-showcase">
          <h1>makemore Name Generator</h1>

          {/* Project Summary */}
          <section id="summary" className="makemore-section">
            <h2>Project Summary</h2>
            <p>
              The makemore project is a character-level name generator that iteratively evolves from a basic bigram model to a sophisticated deep learning architecture. Over four iterations, I moved from counting character pairs to learnable embeddings, deep MLPs with BatchNorm, and finally a Convolutional Neural Network (CNN), each step improved loss and output quality.
            </p>
            <p>
              Beyond generating names, makemore embodies core language-modeling principles: it uses a context window to track preceding characters and predict the next token. While this project works on character-level prediction, large language models operate on word pieces or full words using the same underlying mechanics. Understanding context windows, token embeddings, and sequential prediction here lays the groundwork for grasping how transformers and other architectures generate coherent text at scale.
            </p>
            <p>
              The final model is the best and is built with a CNN with multiple 1D convolutional layers and BatchNorm, capturing longer context and producing highly plausible name-like strings. It achieves a training loss of roughly 1.77 and a validation loss of around 1.99, generating names such as “elyza.”, “reyden.”, and “renna.”
            </p>
          </section>

          {/* Iteration 1: Bigram Model */}
          <section id="iteration-1" className="makemore-section">
            <h2>Iteration 1: Bigram Model</h2>
            <p>
              The bigram model counts pairs of characters. It learns which character follows which with no deeper context. Outputs are variable-length but often still gibberish.
            </p>
            <p>
              This simple statistical model builds a 27×27 matrix of counts for every possible character pair (including the end-of-word marker). It uses these frequencies to sample the next character, resulting in very short names or occasional longer sequences, but with no understanding of deeper patterns like vowels vs. consonants.
            </p>
            <p>
              According to the loss curve, this model achieved a training loss of 2.480 nats/char.
            </p>
            <img
              className="display-image"
              src="/images/makemore/build_makemore_1.png"
              alt="Bigram count matrix heatmap"
            />
            <p>
              This heatmap of the bigram count matrix shows how often each character pair appears in the training data.
            </p>
            <img
              className="display-image"
              src="/images/makemore/build_makemore_2.png"
              alt="Word length distribution chart"
            />
            <p>
              This chart visualizes five separate generation runs under the bigram model. Each row is one run, each column is a time step, and the yellow square marks when the model produced the end-of-word token (“.”). It shows how word lengths vary—from very short to around 14 characters.
            </p>
            <p>Sample outputs:</p>
            <ul>
              <li>cexze.</li>
              <li>momasuraillezityha.</li>
              <li>konimittain.</li>
            </ul>
          </section>

          {/* Iteration 2: One-layer Neural Net (MLP) */}
          <section id="iteration-2" className="makemore-section">
            <h2>Iteration 2: MLP with Learned Embeddings</h2>
            <p>
              Transitioned to a trainable one-layer neural network. Learned continuous embeddings smooth the bigram counts and improve generalization.
            </p>
            <p>
              By learning an embedding for each character, the model maps discrete one-hot vectors into a continuous space where similar characters (e.g., vowels) cluster together. The subsequent linear layer transforms these embeddings into logits, smoothing rare bigram edges and improving generalization to unseen pairs.
            </p>
            <p>
              According to the loss curve, this model achieved a training loss of 1.93 nats/char.
            </p>
            <img
              className="display-image"
              src="/images/makemore/mlp_makemore_1.png"
              alt="MLP training loss curve"
            />
            <p>
              This training loss curve illustrates the fast initial convergence and stable plateau around 0.4 nats/char.
            </p>
            <img
              className="display-image"
              src="/images/makemore/mlp_makemore_2.png"
              alt="Sample names from MLP model"
            />
            <p>
              Description: 2D projection of the learned character embeddings (via PCA), showing how vowels cluster together, common consonants group centrally, and rare letters like 'q', 'j', and 'z' occupy peripheral positions.
            </p>
            <p>Sample outputs:</p>
            <ul>
              <li>carpah.</li>
              <li>amelle.</li>
              <li>khy.</li>
            </ul>
          </section>

          {/* Iteration 3: Deep MLP with BatchNorm */}
          <section id="iteration-3" className="makemore-section">
            <h2>Iteration 3: Deep MLP + BatchNorm</h2>
            <p>
              Based on the loss curves, this model achieved a training loss of 2.01 nats/char and a validation loss of 2.08 nats/char, while producing much more plausible names.
            </p>
            <p>
              Adding four extra hidden layers with BatchNorm between them normalized the input to each nonlinearity, preventing saturation and vanishing gradients. Training became faster and more stable, and the model learned higher-order character dependencies, producing more realistic syllable structures.
            </p>
            <img
              className="display-image"
              src="/images/makemore/bn_makemore_1.png"
              alt="Activation distributions after BatchNorm"
            />
            <p>
              Description: Activation distribution histograms for multiple layers, showing centered, non-saturated values after applying BatchNorm.
            </p>
            <img
              className="display-image"
              src="/images/makemore/bn_makemore_2.png"
              alt="Gradient distribution after BatchNorm"
            />
            <p>
              Description: Gradient distribution per layer, indicating uniform, non-vanishing gradients throughout the network.
            </p>
            <p>Sample outputs:</p>
            <ul>
              <li>carlah.</li>
              <li>amelle.</li>
              <li>khyriri.</li>
            </ul>
          </section>

          {/* Iteration 4: CNN-based Model */}
          <section id="iteration-4" className="makemore-section">
            <h2>Iteration 4: CNN</h2>
            <p>
              According to the loss curves, this model achieved a training loss of 1.77 nats/char and a validation loss of 1.99 nats/char, indicating improved performance over previous iterations.
            </p>
            <p>
              The CNN applies 1D convolutions with a kernel size of three across the character embeddings, allowing each output position to attend to a window of previous characters. This hierarchical receptive field captures longer context than MLPs, enabling patterns like common name suffixes (e.g., "-son", "-ine") to emerge in the generated outputs.
            </p>
            <img
              className="display-image"
              src="/images/makemore/cnn_makemore_1.png"
              alt="Learning rate decay for CNN model"
            />
            <p>
              Learning rate decay schedule is shown over epochs, highlighting the gradual reduction from the initial learning rate.
            </p>
            <img
              className="display-image"
              src="/images/makemore/cnn_makemore_2.png"
              alt="Log update-to-weight ratio during training from CNN model"
            />
            <p>
              Description: Log update-to-weight ratio plot, illustrating stable relative parameter updates across layers during training.
            </p>
            <p>Sample outputs:</p>
            <ul>
              <li>elyza.</li>
              <li>reyden.</li>
              <li>renna.</li>
            </ul>
          </section>

        </div>
      </main>
    </>
  );
}

export default MakemoreShowcase;