/**
 * Popup header/context rendering helpers.
 * Owns the popup header context line, Jira shortcut links, and selected-count pill rendering.
 */

/**
 * Updates the selected-node summary pill.
 *
 * @param {number} selectedCount Number of currently selected nodes.
 * @param {number} totalCount Total nodes on the page when known.
 */
function updateSelectedNodeCount(selectedCount, totalCount) {
  if (!(selectedNodeCountEl instanceof HTMLElement)) {
    return;
  }

  const selected = Number.isFinite(Number(selectedCount)) ? Math.max(0, Number(selectedCount)) : 0;
  const total = Number.isFinite(Number(totalCount)) ? Math.max(0, Number(totalCount)) : 0;
  const label = total > 0 ? `${selected.toLocaleString()} / ${total.toLocaleString()}` : `${selected.toLocaleString()}`;
  selectedNodeCountEl.textContent = label;
  selectedNodeCountEl.title =
    total > 0
      ? `${selected.toLocaleString()} of ${total.toLocaleString()} PR nodes currently selected`
      : `${selected.toLocaleString()} PR nodes currently selected`;
}

/**
 * Renders Jira issue shortcut links reported by the content script.
 *
 * @param {Array<{key?: string, url?: string}>} links Jira link descriptors for the active PR.
 */
function renderJiraLinks(links) {
  if (!jiraLinksRow) {
    return;
  }
  jiraLinksRow.innerHTML = "";
  const items = Array.isArray(links) ? links.filter((item) => item && item.key) : [];
  if (!items.length) {
    jiraLinksRow.classList.remove("is-visible");
    return;
  }

  for (const item of items.slice(0, 8)) {
    const linkEl = document.createElement(item.url ? "a" : "span");
    linkEl.className = "jira-link-btn";
    linkEl.setAttribute("title", item.url ? `Open ${item.key}` : item.key);
    linkEl.setAttribute("aria-label", item.url ? `Open ${item.key}` : item.key);
    if (item.url) {
      linkEl.setAttribute("href", item.url);
      linkEl.setAttribute("target", "_blank");
      linkEl.setAttribute("rel", "noopener noreferrer");
    }
    linkEl.innerHTML = `
      <span class="jira-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="12" height="12" focusable="false">
          <path fill="currentColor" d="M6.1 3.1h7.8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H6.1a2 2 0 0 1-2-2V5.1a2 2 0 0 1 2-2Zm1.9 3.1a.8.8 0 1 0 0 1.6h3.3L7.8 11a.8.8 0 1 0 1.1 1.1l3.5-3.3v3.1a.8.8 0 0 0 1.6 0V7a.8.8 0 0 0-.8-.8H8Z"/>
        </svg>
      </span>
      <span class="jira-key">${item.key}</span>
    `;
    jiraLinksRow.appendChild(linkEl);
  }
  jiraLinksRow.classList.add("is-visible");
}

/**
 * Updates the popup header context line.
 *
 * @param {{owner?: string, repo?: string, prNumber?: number} | null} urlMeta Parsed PR URL metadata.
 * @param {{owner?: string, repo?: string, prNumber?: number, sourceBranch?: string, targetBranch?: string} | null} pageContext Content-script context.
 */
function setHeaderContextFromTab(urlMeta, pageContext) {
  const owner = pageContext?.owner || urlMeta?.owner || null;
  const repo = pageContext?.repo || urlMeta?.repo || null;
  const prNumber = pageContext?.prNumber || urlMeta?.prNumber || null;
  const source = pageContext?.sourceBranch || null;
  const target = pageContext?.targetBranch || null;

  const parts = [];
  if (owner && repo) {
    parts.push(`${owner}/${repo}`);
  }
  if (prNumber) {
    parts.push(`PR #${prNumber}`);
  }
  if (source || target) {
    const src = source || "?";
    const dst = target || "?";
    parts.push(`${src} -> ${dst}`);
  }

  const value = parts.join(" • ");
  headerContextEl.textContent = value;
  headerContextEl.classList.toggle("is-visible", Boolean(value));
}
