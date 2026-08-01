export const MILLISECONDS_PER_SECOND = 1_000;
export const DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS = 15_000;
export const MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS = MILLISECONDS_PER_SECOND;
export const MAXIMUM_DOWNLOAD_REFRESH_INTERVAL_MS = 300_000;
export const IDLE_DOWNLOAD_REFRESH_INTERVAL_MS = 15_000;

/** Select the active or idle polling cadence for download-aware views. */
export const getDownloadRefreshInterval = (
  hasActiveDownloads: boolean,
  activeRefreshIntervalMS: number
): number =>
  hasActiveDownloads
    ? activeRefreshIntervalMS
    : Math.max(activeRefreshIntervalMS, IDLE_DOWNLOAD_REFRESH_INTERVAL_MS);

/** Normalize a persisted polling interval to whole seconds within safe limits. */
export const normalizeDownloadRefreshInterval = (value: unknown): number => {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS;
  }

  const numericValue: number = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS;
  }

  const wholeSecondValue: number =
    Math.round(numericValue / MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS) *
    MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS;
  return Math.min(
    MAXIMUM_DOWNLOAD_REFRESH_INTERVAL_MS,
    Math.max(MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS, wholeSecondValue)
  );
};
