/**
 * Website Content Scraper
 *
 * Fetches and cleans text content from Mercy House website for Grace's context.
 */

/**
 * Key Mercy House URLs to pull context from.
 */
const MERCY_URLS = [
  'https://mercyhouseatc.com/',
  'https://mercyhouseatc.com/about/',
  'https://mercyhouseatc.com/program/',
  'https://mercyhouseatc.com/contact/',
];

/**
 * Fetch and lightly clean text content from the Mercy House site
 * so Grace can answer questions based on real info.
 */
async function fetchMercyHouseContent() {
  try {
    const chunks = [];

    for (const url of MERCY_URLS) {
      const res = await fetch(url);
      const html = await res.text();

      // Strip scripts/styles and HTML tags, compress whitespace
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit per-page chunk to keep instructions reasonable in size
      chunks.push(`From ${url}:\n${text.slice(0, 2000)}`);
    }

    return chunks.join('\n\n');
  } catch (err) {
    console.error('Error fetching Mercy House content:', err);
    // If we fail to fetch, return empty string so session still works
    return '';
  }
}

module.exports = {
  fetchMercyHouseContent,
  MERCY_URLS,
};
