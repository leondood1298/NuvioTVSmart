const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 2;

export function normalizeAppVersion(raw) {
  return String(raw || "")
    .trim()
    .replace(/^[vV]/, "");
}

export function parseAppVersionParts(raw) {
  const normalized = normalizeAppVersion(raw);
  if (!normalized) {
    return null;
  }

  const parts = normalized
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((token) => {
      const match = String(token).match(/^\d+/);
      return match ? Number.parseInt(match[0], 10) : null;
    })
    .filter((part) => Number.isFinite(part));

  return parts.length > 0 ? parts : null;
}

export function isRemoteAppVersionNewer(remote, local) {
  const remoteParts = parseAppVersionParts(remote);
  const localParts = parseAppVersionParts(local);

  if (!remoteParts || !localParts) {
    const normalizedRemote = normalizeAppVersion(remote);
    const normalizedLocal = normalizeAppVersion(local);
    return Boolean(normalizedRemote && normalizedLocal && normalizedRemote !== normalizedLocal);
  }

  const length = Math.max(remoteParts.length, localParts.length);
  for (let index = 0; index < length; index += 1) {
    const remotePart = remoteParts[index] || 0;
    const localPart = localParts[index] || 0;
    if (remotePart !== localPart) {
      return remotePart > localPart;
    }
  }
  return false;
}

function releaseTag(release) {
  return String(release?.tag_name || release?.name || "").trim();
}

export function parseLatestRelease(release) {
  if (!release || release.draft || release.prerelease) {
    return null;
  }

  const tag = releaseTag(release);
  if (!tag) {
    return null;
  }

  return {
    tag,
    title: String(release.name || tag).trim() || tag,
    notes: String(release.body || "").trim(),
    releaseUrl: String(release.html_url || "").trim() || null
  };
}

// NUVIO_APP_UPDATES_DISABLED_V1: preserve this TV's compatibility build.
export async function getLatestAppUpdate() {
  return null;
}

function isRetryableUpdateCheckError(error) {
  const status = Number(error?.status || 0);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export async function getLatestAppUpdateWithRetry({
  currentVersion,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
} = {}) {
  const attempts = Math.max(1, Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getLatestAppUpdate({ currentVersion, fetchImpl, timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableUpdateCheckError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(retryDelayMs) || 0)));
    }
  }

  throw lastError || new Error("App update check failed");
}
