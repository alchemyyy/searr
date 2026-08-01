import { getDownloadRefreshInterval } from '@server/constants/settings';
import type { DownloadingItem } from '@server/lib/downloadtracker';

export const refreshIntervalHelper = (
  downloadItems: {
    downloadStatus: DownloadingItem[] | undefined;
    downloadStatus4k: DownloadingItem[] | undefined;
  },
  activeRefreshIntervalMS: number
): number => {
  const hasActiveDownloads: boolean =
    (downloadItems.downloadStatus ?? []).length > 0 ||
    (downloadItems.downloadStatus4k ?? []).length > 0;

  return getDownloadRefreshInterval(
    hasActiveDownloads,
    activeRefreshIntervalMS
  );
};
