/**
 * Lightweight sentiment analysis using a small transformer model.
 * Runs locally via @huggingface/transformers (ONNX runtime).
 * Model: cardiffnlp/twitter-roberta-base-sentiment-latest (~125MB, cached after first download)
 *
 * Returns: { label: 'positive'|'neutral'|'negative', score: 0.0-1.0 }
 */

let pipeline = null;
let sentimentPipeline = null;
let loadingPromise = null;
let loadFailed = false;

const MODEL_NAME = 'Xenova/twitter-roberta-base-sentiment-latest';

/**
 * Initialize the sentiment pipeline. Called once on first use.
 * Model is downloaded automatically and cached in ~/.cache/huggingface.
 */
async function loadPipeline() {
  if (sentimentPipeline) return sentimentPipeline;
  if (loadFailed) return null;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const { pipeline: createPipeline } = await import('@huggingface/transformers');
      pipeline = createPipeline;
      sentimentPipeline = await pipeline('sentiment-analysis', MODEL_NAME, {
        // Use quantized model for faster inference
        quantized: true,
      });
      console.log('✅ Sentiment model loaded');
      return sentimentPipeline;
    } catch (err) {
      console.warn('⚠️ Sentiment model failed to load (non-critical):', err.message);
      loadFailed = true;
      return null;
    }
  })();

  return loadingPromise;
}

/**
 * Analyze sentiment of a text string.
 *
 * @param {string} text - The text to analyze
 * @returns {Promise<{ label: string, score: number }|null>} Sentiment result or null if unavailable
 */
export async function analyzeSentiment(text) {
  if (!text || text.trim().length < 3) return null;

  const pipe = await loadPipeline();
  if (!pipe) return null;

  try {
    // Truncate long text — model max is 512 tokens, ~200 words is safe
    const truncated = text.length > 800 ? text.substring(0, 800) : text;
    const results = await pipe(truncated);

    if (results && results.length > 0) {
      const result = results[0];
      // Normalize label names
      const labelMap = {
        'positive': 'positive',
        'negative': 'negative',
        'neutral': 'neutral',
        // Some models use LABEL_0, LABEL_1, LABEL_2
        'LABEL_0': 'negative',
        'LABEL_1': 'neutral',
        'LABEL_2': 'positive',
      };
      return {
        label: labelMap[result.label] || result.label,
        score: Math.round(result.score * 100) / 100,
      };
    }
  } catch (err) {
    console.warn('Sentiment analysis error:', err.message);
  }

  return null;
}

/**
 * Convert a sentiment trail into a human-readable trajectory description.
 *
 * @param {Array<{ label: string, score: number, turn: number }>} trail - Recent sentiment entries
 * @param {number} currentTurn - Current turn number
 * @returns {string} Description like "positive (stable)" or "negative (sharp drop from positive 2 turns ago)"
 */
export function describeSentimentTrajectory(trail, currentTurn) {
  if (!trail || trail.length === 0) return '';

  const latest = trail[trail.length - 1];
  const label = latest.label;

  if (trail.length === 1) {
    return `${label} (${latest.score > 0.8 ? 'strong' : 'mild'})`;
  }

  // Check for shifts
  const previous = trail[trail.length - 2];
  if (previous.label !== latest.label) {
    const turnsAgo = currentTurn - previous.turn;
    return `${label} (shifted from ${previous.label} ${turnsAgo} turn${turnsAgo !== 1 ? 's' : ''} ago)`;
  }

  // Check for trending
  if (trail.length >= 3) {
    const scores = trail.slice(-3).map(t => t.label === 'positive' ? 1 : t.label === 'negative' ? -1 : 0);
    const trend = scores[2] - scores[0];
    if (trend > 0) return `${label} (trending more positive)`;
    if (trend < 0) return `${label} (trending more negative)`;
  }

  return `${label} (stable)`;
}

/**
 * Pre-download the model. Called during install/setup.
 */
export async function preloadModel() {
  console.log('📥 Pre-loading sentiment model...');
  const pipe = await loadPipeline();
  if (pipe) {
    // Run a warm-up inference
    await analyzeSentiment('Hello, this is a test.');
    console.log('✅ Sentiment model ready');
  }
}
