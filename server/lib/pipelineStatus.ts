import type { HealthCheckResult } from '@server/api/servarr/base';
import { MediaStatus } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';

export type PipelineStatusCode =
  | 'BLOCKED_NO_DOWNLOAD_CLIENT'
  | 'BLOCKED_NO_INDEXERS'
  | 'DELAYED'
  | 'DOWNLOADING'
  | 'DOWNLOAD_CLIENT_UNAVAILABLE'
  | 'DOWNLOAD_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'DOWNLOAD_PAUSED'
  | 'DOWNLOAD_WARNING'
  | 'IMPORTED_WAITING_SCAN'
  | 'IMPORT_BLOCKED'
  | 'IMPORT_PENDING'
  | 'IMPORTING'
  | 'PROCESSING'
  | 'QUEUED'
  | 'SEARCHING'
  | 'SENT_TO_ARR'
  | 'WAITING_LIBRARY_SCAN';

export interface PipelineStatus {
  code: PipelineStatusCode;
  label: string;
  level: 'normal' | 'warning' | 'error';
  progress?: number;
  details?: string;
}

interface PipelineStatusParameters {
  mediaStatus: MediaStatus;
  downloadItems: DownloadingItem[];
  healthChecks: HealthCheckResult[];
  jellyfinScanRunning: boolean;
  serverType: 'radarr' | 'sonarr';
}

const formatProgress = (item: DownloadingItem): number => {
  if (item.size <= 0) {
    return 0;
  }

  const progress: number = Math.round(
    ((item.size - item.sizeLeft) / item.size) * 100
  );
  return Math.min(100, Math.max(0, progress));
};

const getStatusMessagesText = (
  items: DownloadingItem[]
): string | undefined => {
  const messages: string[] = [];

  for (const item of items) {
    for (const statusMessage of item.statusMessages) {
      messages.push(...statusMessage.messages);
    }
  }

  return messages.length > 0 ? messages.join('; ') : undefined;
};

const getItemPriority = (item: DownloadingItem): number => {
  switch (item.trackedDownloadState) {
    case 'failed':
    case 'failedPending':
      return 0;
    case 'importBlocked':
      return 1;
  }

  const normalizedStatus: string = item.status.toLowerCase();
  switch (item.trackedDownloadStatus) {
    case 'error':
      return 2;
    case 'warning':
      return 3;
  }

  switch (normalizedStatus) {
    case 'failed':
    case 'downloadclientunavailable':
      return 2;
    case 'warning':
      return 3;
    case 'paused':
      return 4;
  }

  switch (item.trackedDownloadState) {
    case 'importing':
      return 5;
    case 'importPending':
      return 6;
    case 'imported':
      return 7;
    case 'downloading':
      return 8;
    default:
      return 99;
  }
};

const getWorstItem = (items: DownloadingItem[]): DownloadingItem => {
  let worstItem: DownloadingItem = items[0];
  let worstPriority: number = getItemPriority(worstItem);

  for (let index = 1; index < items.length; index += 1) {
    const item: DownloadingItem = items[index];
    const itemPriority: number = getItemPriority(item);
    if (itemPriority < worstPriority) {
      worstItem = item;
      worstPriority = itemPriority;
    }
  }

  return worstItem;
};

/** Derive the highest-priority user-facing state for a Servarr pipeline. */
export const computePipelineStatus = ({
  mediaStatus,
  downloadItems,
  healthChecks,
  jellyfinScanRunning,
  serverType,
}: PipelineStatusParameters): PipelineStatus | null => {
  const serverLabel: string = serverType === 'radarr' ? 'Radarr' : 'Sonarr';

  if (
    mediaStatus !== MediaStatus.PENDING &&
    mediaStatus !== MediaStatus.PROCESSING &&
    downloadItems.length === 0
  ) {
    return null;
  }

  if (downloadItems.length === 0) {
    const downloadClientIssue: HealthCheckResult | undefined =
      healthChecks.find(
        (healthCheck) =>
          healthCheck.source.toLowerCase().includes('downloadclient') &&
          (healthCheck.type === 'error' || healthCheck.type === 'warning')
      );

    if (downloadClientIssue) {
      return {
        code: 'BLOCKED_NO_DOWNLOAD_CLIENT',
        label: 'Blocked: No download client online',
        level: 'error',
        details: downloadClientIssue.message,
      };
    }

    // Servarr reports individual indexer failures as warnings and total loss as an error
    const indexerIssue: HealthCheckResult | undefined = healthChecks.find(
      (healthCheck) =>
        healthCheck.source.toLowerCase().includes('indexer') &&
        healthCheck.type === 'error'
    );

    if (indexerIssue) {
      return {
        code: 'BLOCKED_NO_INDEXERS',
        label: 'Blocked: No indexers available',
        level: 'error',
        details: indexerIssue.message,
      };
    }

    if (mediaStatus === MediaStatus.PROCESSING && jellyfinScanRunning) {
      return {
        code: 'WAITING_LIBRARY_SCAN',
        label: 'Waiting for library scan',
        level: 'normal',
      };
    }

    switch (mediaStatus) {
      case MediaStatus.PROCESSING:
        return {
          code: 'SEARCHING',
          label: `${serverLabel}: Searching for releases`,
          level: 'normal',
        };
      case MediaStatus.PENDING:
        return {
          code: 'SENT_TO_ARR',
          label: `Sent to ${serverLabel}`,
          level: 'normal',
        };
      default:
        return null;
    }
  }

  const primary: DownloadingItem =
    downloadItems.length === 1 ? downloadItems[0] : getWorstItem(downloadItems);
  const details: string | undefined = getStatusMessagesText(downloadItems);
  const normalizedStatus: string = primary.status.toLowerCase();

  switch (primary.trackedDownloadState) {
    case 'failed':
    case 'failedPending':
      return {
        code: 'DOWNLOAD_FAILED',
        label: 'Download failed',
        level: 'error',
        details,
      };
    case 'importBlocked':
      return {
        code: 'IMPORT_BLOCKED',
        label: 'Import blocked - manual intervention required',
        level: 'error',
        details,
      };
  }

  if (
    primary.trackedDownloadStatus === 'error' ||
    normalizedStatus === 'failed'
  ) {
    return {
      code: 'DOWNLOAD_ERROR',
      label: 'Download error',
      level: 'error',
      details,
    };
  }

  if (
    primary.trackedDownloadStatus === 'warning' ||
    normalizedStatus === 'warning'
  ) {
    return {
      code: 'DOWNLOAD_WARNING',
      label: `Download warning${
        primary.downloadClient ? ` (${primary.downloadClient})` : ''
      }`,
      level: 'warning',
      details,
    };
  }

  switch (normalizedStatus) {
    case 'paused':
      return {
        code: 'DOWNLOAD_PAUSED',
        label: `Download paused${
          primary.downloadClient ? ` in ${primary.downloadClient}` : ''
        }`,
        level: 'warning',
        progress: formatProgress(primary),
      };
    case 'downloadclientunavailable':
      return {
        code: 'DOWNLOAD_CLIENT_UNAVAILABLE',
        label: 'Blocked: Download client unavailable',
        level: 'error',
        details,
      };
    case 'queued':
      return {
        code: 'QUEUED',
        label: `Queued${
          primary.downloadClient ? ` in ${primary.downloadClient}` : ''
        }`,
        level: 'normal',
      };
    case 'delay':
      return {
        code: 'DELAYED',
        label: 'Delayed - awaiting better quality',
        level: 'normal',
      };
  }

  switch (primary.trackedDownloadState) {
    case 'importing':
      return {
        code: 'IMPORTING',
        label: `${serverLabel}: Importing`,
        level: 'normal',
      };
    case 'importPending':
      return {
        code: 'IMPORT_PENDING',
        label: `${serverLabel}: Import pending`,
        level: 'normal',
      };
    case 'imported':
      return jellyfinScanRunning
        ? {
            code: 'WAITING_LIBRARY_SCAN',
            label: 'Waiting for library scan',
            level: 'normal',
          }
        : {
            code: 'IMPORTED_WAITING_SCAN',
            label: `${serverLabel}: Imported, waiting for scan`,
            level: 'normal',
          };
    case 'downloading': {
      const progress: number = formatProgress(primary);
      const clientLabel: string = primary.downloadClient || 'download client';

      if (downloadItems.length > 1) {
        const activeCount: number = downloadItems.filter(
          (item) =>
            item.trackedDownloadState === 'downloading' ||
            item.status.toLowerCase() === 'downloading'
        ).length;
        const itemLabel: string =
          activeCount === 1 ? '1 item' : `${activeCount} items`;

        return {
          code: 'DOWNLOADING',
          label: `Downloading ${itemLabel} via ${clientLabel}`,
          level: 'normal',
          progress,
        };
      }

      return {
        code: 'DOWNLOADING',
        label: `Downloading via ${clientLabel} (${progress}%)`,
        level: 'normal',
        progress,
      };
    }
  }

  if (normalizedStatus && normalizedStatus !== 'unknown') {
    return {
      code: 'PROCESSING',
      label: `${serverLabel}: ${primary.status}`,
      level: 'normal',
    };
  }

  return null;
};
