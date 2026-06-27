/**
 * Content code-context helpers.
 * Extracts bounded diff context around conversation targets from Gitea diff tables.
 */

/**
 * Attempts to extract code context for a conversation target from nearby diff tables.
 *
 * @param {Element} block Conversation block.
 * @param {number | { lineNew?: number, lineOld?: number, diffSide?: string }} target Target line metadata.
 * @returns {{ lines: Array<object>, hunkHeader?: string } | null} Extracted code context.
 */
function maybeExtractCodeContext(block, target) {
  if (!(block instanceof Element)) {
    return null;
  }

  const targetMeta = normalizeCodeContextTarget(target);
  if (!targetMeta) {
    return null;
  }

  const tables = Array.from(block.querySelectorAll("table"));
  for (const table of tables) {
    const context = extractCodeContextFromDiffTable(table, targetMeta);
    if (context) {
      return context;
    }
  }

  return null;
}

function normalizeCodeContextTarget(target) {
  if (Number.isInteger(target) && target > 0) {
    return { lineNew: target, lineOld: null, diffSide: "new" };
  }
  if (!target || typeof target !== "object") {
    return null;
  }
  const lineNew = Number.isInteger(target.lineNew) && target.lineNew > 0 ? target.lineNew : null;
  const lineOld = Number.isInteger(target.lineOld) && target.lineOld > 0 ? target.lineOld : null;
  const diffSide = target.diffSide === "old" ? "old" : "new";
  if (!lineNew && !lineOld) {
    return null;
  }
  return { lineNew, lineOld, diffSide };
}

function extractCodeContextFromDiffTable(table, targetMeta) {
  if (!(table instanceof Element)) {
    return null;
  }

  const rows = Array.from(table.querySelectorAll("tr[data-line-type]"));
  if (!rows.length) {
    return null;
  }

  const parsedRows = [];
  let currentHunkHeader = null;
  for (const row of rows) {
    const lineType = String(row.getAttribute("data-line-type") || "");
    if (lineType === "tag") {
      currentHunkHeader = extractHunkHeaderFromRow(row);
      continue;
    }
    if (!["same", "add", "del"].includes(lineType)) {
      continue;
    }

    const parsed = parseDiffCodeRow(row, lineType);
    if (!parsed) {
      continue;
    }
    parsedRows.push({ ...parsed, hunkHeader: currentHunkHeader });
  }

  if (!parsedRows.length) {
    return null;
  }

  const targetIndex = findTargetDiffRowIndex(parsedRows, targetMeta);
  if (targetIndex < 0) {
    return null;
  }

  const targetRow = parsedRows[targetIndex];
  const sameHunkRows = parsedRows.filter((row) => row.hunkHeader === targetRow.hunkHeader);
  const indexWithinHunk = sameHunkRows.findIndex((row) => row === targetRow);
  if (indexWithinHunk < 0) {
    return null;
  }

  const boundedRows = selectGroundedContextRows(sameHunkRows, indexWithinHunk, 9);
  if (!boundedRows.length) {
    return null;
  }

  const codeContext = {
    lines: boundedRows.map((row) => ({
      type: row.type,
      oldLine: row.oldLine,
      newLine: row.newLine,
      marker: row.marker,
      text: row.text,
    })),
  };
  if (targetRow.hunkHeader) {
    codeContext.hunkHeader = targetRow.hunkHeader;
  }
  return codeContext;
}

function extractHunkHeaderFromRow(row) {
  const hunkText = row.querySelector(".blob-hunk .code-inner, .blob-hunk")?.textContent;
  return valueOrNull(hunkText);
}

function parseDiffCodeRow(row, lineType) {
  const oldLineRaw = row.querySelector(".lines-num-old[data-line-num]")?.getAttribute("data-line-num");
  const newLineRaw = row.querySelector(".lines-num-new[data-line-num]")?.getAttribute("data-line-num");
  const oldLine = parseDiffLineNum(oldLineRaw);
  const newLine = parseDiffLineNum(newLineRaw);
  const marker = extractDiffTypeMarker(row);
  const codeText = extractVisibleDiffCodeText(row);
  if (codeText === null) {
    return null;
  }
  return {
    type: lineType,
    oldLine,
    newLine,
    marker,
    text: codeText,
  };
}

function parseDiffLineNum(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractDiffTypeMarker(row) {
  const marker = row.querySelector("[data-type-marker]")?.getAttribute("data-type-marker");
  const normalized = marker === "+" || marker === "-" || marker === " " ? marker : "";
  return normalized;
}

function extractVisibleDiffCodeText(row) {
  const codeNode = row.querySelector("td.lines-code code.code-inner, td.lines-code .code-inner, td.lines-code");
  if (!(codeNode instanceof Element)) {
    return null;
  }
  let text = codeNode.textContent || "";
  text = text.replace(/\r/g, "");
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");
  if (/^\s+$/.test(text)) {
    return "";
  }
  return text;
}

function findTargetDiffRowIndex(rows, targetMeta) {
  const targetLine = targetMeta.diffSide === "old" ? targetMeta.lineOld : targetMeta.lineNew;
  if (targetLine) {
    const key = targetMeta.diffSide === "old" ? "oldLine" : "newLine";
    const exactIndex = rows.findIndex((row) => row[key] === targetLine);
    if (exactIndex >= 0) {
      return exactIndex;
    }
  }

  if (targetMeta.lineNew) {
    const newIndex = rows.findIndex((row) => row.newLine === targetMeta.lineNew);
    if (newIndex >= 0) {
      return newIndex;
    }
  }
  if (targetMeta.lineOld) {
    const oldIndex = rows.findIndex((row) => row.oldLine === targetMeta.lineOld);
    if (oldIndex >= 0) {
      return oldIndex;
    }
  }

  return -1;
}

function selectGroundedContextRows(rows, targetIndex, maxRows) {
  if (!rows.length) {
    return [];
  }
  if (rows.length <= maxRows) {
    return rows;
  }

  let clusterStart = targetIndex;
  let clusterEnd = targetIndex;
  while (clusterStart > 0 && rows[clusterStart - 1].type !== "same") {
    clusterStart -= 1;
  }
  while (clusterEnd < rows.length - 1 && rows[clusterEnd + 1].type !== "same") {
    clusterEnd += 1;
  }

  let start = clusterStart;
  let end = clusterEnd;
  let sameBefore = 0;
  let sameAfter = 0;

  let addedSame = true;
  while (addedSame && end - start + 1 < maxRows) {
    addedSame = false;
    if (start > 0 && sameBefore < 3 && rows[start - 1].type === "same") {
      start -= 1;
      sameBefore += 1;
      addedSame = true;
    }
    if (end < rows.length - 1 && sameAfter < 3 && end - start + 1 < maxRows && rows[end + 1].type === "same") {
      end += 1;
      sameAfter += 1;
      addedSame = true;
    }
  }

  while (end - start + 1 < maxRows) {
    if (start > 0) {
      start -= 1;
    } else if (end < rows.length - 1) {
      end += 1;
    } else {
      break;
    }
  }

  return rows.slice(start, end + 1);
}
