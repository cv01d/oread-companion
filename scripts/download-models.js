#!/usr/bin/env node

/**
 * Post-install script: downloads the sentiment analysis model.
 * Runs automatically after `npm install`.
 * Model is cached in ~/.cache/huggingface — subsequent installs are instant.
 */

async function downloadModels() {
  console.log('\n📥 Downloading sentiment analysis model...');
  console.log('   (This is a one-time ~125MB download, cached for future use)\n');

  try {
    const { pipeline } = await import('@huggingface/transformers');
    const sentiment = await pipeline('sentiment-analysis', 'Xenova/twitter-roberta-base-sentiment-latest', {
      quantized: true,
    });

    // Warm-up inference to verify it works
    const result = await sentiment('This is a test.');
    console.log(`✅ Sentiment model downloaded and verified (test: ${result[0].label})\n`);
  } catch (err) {
    console.warn(`⚠️  Sentiment model download failed (non-critical): ${err.message}`);
    console.warn('   The app will work without it — sentiment features will be disabled.\n');
  }
}

downloadModels();
