/**
 * Popup filename helpers.
 * Owns filename and timestamp helpers shared across popup download flows.
 */

function buildFilename(_urlString, _title) {
  const stamp = getTimestampLocal();
  return `gitea-cr-${stamp}.json`;
}

function buildDiffFilename(urlString, title) {
  const base = buildFilename(urlString, title).replace(/\.json$/i, "");
  return `${base}.diff`;
}

function buildBundleFilename(urlString, context) {
  const prNumber = Number.parseInt(String(context?.prNumber || ""), 10);
  const resolvedNumber =
    Number.isInteger(prNumber) && prNumber > 0 ? String(prNumber) : extractPrNumber(urlString) || "unknown";
  return `${resolvedNumber}-changes-JSON+DIFF.zip`;
}

function getTimestampLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}-${hh}.${min}.${ss}`;
}
