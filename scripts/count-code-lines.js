import { readFileSync } from "node:fs";

const file = process.argv[2] || "index.html";
const text = readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

let inBlockComment = false;
let codeLines = 0;
let blankLines = 0;
let commentLines = 0;

function hasCodeOutsideComments(rawLine) {
  let line = rawLine;
  let hasCode = false;

  while (line.length > 0) {
    if (inBlockComment) {
      const end = line.indexOf("*/");
      const htmlEnd = line.indexOf("-->");
      const closeAt = end === -1 ? htmlEnd : htmlEnd === -1 ? end : Math.min(end, htmlEnd);
      if (closeAt === -1) return hasCode;
      line = line.slice(closeAt + (line.startsWith("<!--", closeAt) ? 4 : line.slice(closeAt, closeAt + 3) === "-->" ? 3 : 2));
      inBlockComment = false;
      continue;
    }

    const trimmed = line.trimStart();
    if (trimmed.length === 0) return hasCode;
    if (trimmed.startsWith("//")) return hasCode;

    const jsBlock = trimmed.indexOf("/*");
    const htmlBlock = trimmed.indexOf("<!--");
    const inlineComment = trimmed.indexOf("//");
    const commentStarts = [jsBlock, htmlBlock, inlineComment].filter(i => i >= 0);
    const firstComment = commentStarts.length ? Math.min(...commentStarts) : -1;

    if (firstComment > 0) return true;
    if (firstComment === -1) return true;

    const marker = trimmed.startsWith("<!--") ? "-->" : trimmed.startsWith("/*") ? "*/" : null;
    if (!marker) return hasCode;

    const end = trimmed.indexOf(marker, marker === "-->" ? 4 : 2);
    if (end === -1) {
      inBlockComment = true;
      return hasCode;
    }
    line = trimmed.slice(end + marker.length);
  }

  return hasCode;
}

for (const line of lines) {
  if (line.trim().length === 0) {
    blankLines++;
  } else if (hasCodeOutsideComments(line)) {
    codeLines++;
  } else {
    commentLines++;
  }
}

console.log(JSON.stringify({
  file,
  totalLines: lines.length,
  codeLines,
  blankLines,
  commentOnlyLines: commentLines,
}, null, 2));
