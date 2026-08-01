import { MediaStatus } from '@server/constants/media';
import { getDownloadRefreshInterval } from '@server/constants/settings';
import type Media from '@server/entity/Media';
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

export const mediaRefreshInterval = (
  media: Media | undefined,
  sawDownload: { current: boolean },
  activeRefreshIntervalMS: number
): number => {
  if (
    (media?.downloadStatus ?? []).length > 0 ||
    (media?.downloadStatus4k ?? []).length > 0
  ) {
    sawDownload.current = true;
    return activeRefreshIntervalMS;
  }

  // The queue empties before the media turns available, and briefly on every sync reset
  const processing = [media, ...(media?.seasons ?? [])].some(
    (item) =>
      item?.status === MediaStatus.PROCESSING ||
      item?.status4k === MediaStatus.PROCESSING
  );

  return getDownloadRefreshInterval(
    sawDownload.current && processing,
    activeRefreshIntervalMS
  );
};
