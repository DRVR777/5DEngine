/** require_param — fail loud if a required Thinga facet key is missing.
 *  No `??` fallback in calling code. A missing value is the bug; the
 *  Thinga that should declare it is the place to fix it. */
export function requireParam(obj, key, owner) {
  if (obj == null) {
    throw new Error(`[ankhor] requireParam: ${owner} is null/undefined; missing key "${key}"`);
  }
  if (!(key in obj) || obj[key] == null) {
    throw new Error(`[ankhor] requireParam: ${owner} missing key "${key}"`);
  }
  return obj[key];
}
