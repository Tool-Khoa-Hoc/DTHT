const ABSOLUTE_OR_SCHEME_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i;

export function resolveMediaPath(input, basePath) {
  if (typeof input !== 'string') return input;

  const trimmed = input.trim();
  if (!trimmed) return input;

  // Keep absolute URLs and any URI scheme untouched (http, https, data, blob, etc).
  if (ABSOLUTE_OR_SCHEME_RE.test(trimmed)) {
    return trimmed;
  }

  if (!basePath) {
    return trimmed.replace(/\\/g, '/');
  }

  const normalizedRelative = trimmed.replace(/\\/g, '/').replace(/^\.?\//, '');
  return `${basePath}/${normalizedRelative}`;
}
