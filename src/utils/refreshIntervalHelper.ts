import { getDownloadRefreshInterval } from '@server/constants/settings';
import type { DownloadingItem } from '@server/lib/downloadtracker';

export const getRequestDownloadStatus = (
  downloadStatus: DownloadingItem[] | undefined,
  seasonNumbers: number[]
): DownloadingItem[] => {
  const items = downloadStatus ?? [];

  if (!seasonNumbers.length) {
    return items;
  }

  return items.filter(
    (item) => item.episode && seasonNumbers.includes(item.episode.seasonNumber)
  );
};

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
