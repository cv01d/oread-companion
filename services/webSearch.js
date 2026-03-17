/**
 * Web search via Brave Search API.
 * Optional — only runs when webSearch is enabled and API key is configured.
 */

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Search the web using Brave Search API.
 *
 * @param {string} query - Search query
 * @param {string} apiKey - Brave Search API key
 * @param {Object} options
 * @param {number} options.count - Number of results (default 3)
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>>}
 */
export async function searchWeb(query, apiKey, { count = 3 } = {}) {
  if (!query || !apiKey) return [];

  try {
    const url = new URL(BRAVE_SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('count', count.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      console.warn(`Brave Search API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const results = (data.web?.results || []).slice(0, count);

    return results.map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
    }));
  } catch (err) {
    console.warn('Web search failed:', err.message);
    return [];
  }
}

/**
 * Format search results as a context block for injection into the prompt.
 *
 * @param {Array<{ title: string, url: string, snippet: string }>} results
 * @returns {string} Formatted context block
 */
export function formatSearchResults(results) {
  if (!results || results.length === 0) return '';

  const lines = results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.url}`
  );

  return `[Web Search Results]\n${lines.join('\n\n')}`;
}
