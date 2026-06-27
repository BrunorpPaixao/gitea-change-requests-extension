/**
 * Popup diff download data helpers.
 * Owns the low-level diff fetch helper used by diff and bundle workflows.
 */

/**
 * Fetches the full diff text for the active pull request.
 *
 * @param {string} diffUrl Fully-qualified PR diff URL.
 * @returns {Promise<string>} Diff text response body.
 */
async function fetchDiffText(diffUrl) {
  const response = await fetch(diffUrl, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch PR diff (${response.status} ${response.statusText}).`);
  }

  return response.text();
}
