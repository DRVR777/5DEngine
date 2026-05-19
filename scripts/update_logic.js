export function parseLastGoodCommit(text) {
  return (text ?? "").trim().split("\n")[0].trim();
}

export function isCommitStale(localSha, remoteSha) {
  return localSha !== remoteSha;
}

export function buildFallbackMessage(sha) {
  return `Tests failed. Falling back to last known-good commit: ${sha.slice(0, 8)}`;
}
