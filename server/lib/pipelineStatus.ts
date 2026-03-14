import type { HealthCheckResult } from '@server/api/servarr/base';
import { MediaStatus } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';

export interface PipelineStatus {
  code: string;
  label: string;
  level: 'normal' | 'warning' | 'error';
  progress?: number;
  details?: string;
}

function formatProgress(item: DownloadingItem): number {
  if (!item.size || item.size === 0) return 0;
  return Math.round(((item.size - item.sizeLeft) / item.size) * 100);
}

function getStatusMessagesText(items: DownloadingItem[]): string | undefined {
  const messages: string[] = [];
  for (const item of items) {
    for (const sm of item.statusMessages ?? []) {
      if (sm.messages?.length) {
        messages.push(...sm.messages);
      }
    }
  }
  return messages.length > 0 ? messages.join('; ') : undefined;
}

function getWorstItem(items: DownloadingItem[]): DownloadingItem {
  const priority: Record<string, number> = {
    failed: 0,
    failedPending: 1,
    importBlocked: 2,
    importing: 3,
    importPending: 4,
    downloading: 5,
  };

  return items.reduce((worst, item) => {
    const worstPri = priority[worst.trackedDownloadState] ?? 99;
    const itemPri = priority[item.trackedDownloadState] ?? 99;
    return itemPri < worstPri ? item : worst;
  });
}

export function computePipelineStatus(params: {
  mediaStatus: MediaStatus;
  downloadItems: DownloadingItem[];
  healthChecks: HealthCheckResult[];
  jellyfinScanRunning: boolean;
  serverType: 'radarr' | 'sonarr';
}): PipelineStatus | null {
  const {
    mediaStatus,
    downloadItems,
    healthChecks,
    jellyfinScanRunning,
    serverType,
  } = params;

  const serverLabel = serverType === 'radarr' ? 'Radarr' : 'Sonarr';

  // Only compute for in-progress states
  if (
    mediaStatus !== MediaStatus.PENDING &&
    mediaStatus !== MediaStatus.PROCESSING &&
    downloadItems.length === 0
  ) {
    return null;
  }

  // Check health-level blocks when no downloads are active
  if (downloadItems.length === 0 && healthChecks.length > 0) {
    const downloadClientIssue = healthChecks.find(
      (h) =>
        h.source.toLowerCase().includes('downloadclient') &&
        (h.type === 'error' || h.type === 'warning')
    );

    if (downloadClientIssue) {
      return {
        code: 'BLOCKED_NO_DOWNLOAD_CLIENT',
        label: 'Blocked: No download client online',
        level: 'error',
        details: downloadClientIssue.message,
      };
    }

    const indexerIssue = healthChecks.find(
      (h) =>
        h.source.toLowerCase().includes('indexer') &&
        (h.type === 'error' || h.type === 'warning')
    );

    if (indexerIssue) {
      return {
        code: 'BLOCKED_NO_INDEXERS',
        label: 'Blocked: No indexers available',
        level: 'error',
        details: indexerIssue.message,
      };
    }
  }

  // No download items - derive from media status
  if (downloadItems.length === 0) {
    if (mediaStatus === MediaStatus.PROCESSING) {
      return {
        code: 'SEARCHING',
        label: `${serverLabel}: Searching for releases`,
        level: 'normal',
      };
    }

    if (mediaStatus === MediaStatus.PENDING) {
      return {
        code: 'SENT_TO_ARR',
        label: `Sent to ${serverLabel}`,
        level: 'normal',
      };
    }

    return null;
  }

  // We have download items - compute status from the worst one
  const primary =
    downloadItems.length === 1 ? downloadItems[0] : getWorstItem(downloadItems);
  const details = getStatusMessagesText(downloadItems);

  // Failed states
  if (
    primary.trackedDownloadState === 'failed' ||
    primary.trackedDownloadState === 'failedPending'
  ) {
    return {
      code: 'DOWNLOAD_FAILED',
      label: 'Download failed',
      level: 'error',
      details,
    };
  }

  // Import blocked
  if (primary.trackedDownloadState === 'importBlocked') {
    return {
      code: 'IMPORT_BLOCKED',
      label: 'Import blocked - manual intervention required',
      level: 'error',
      details,
    };
  }

  // Warning status
  if (
    primary.trackedDownloadStatus === 'warning' ||
    primary.status.toLowerCase() === 'warning'
  ) {
    return {
      code: 'DOWNLOAD_WARNING',
      label: `Download warning${primary.downloadClient ? ` (${primary.downloadClient})` : ''}`,
      level: 'warning',
      details,
    };
  }

  // Paused
  if (primary.status.toLowerCase() === 'paused') {
    return {
      code: 'DOWNLOAD_PAUSED',
      label: `Download paused${primary.downloadClient ? ` in ${primary.downloadClient}` : ''}`,
      level: 'warning',
      progress: formatProgress(primary),
    };
  }

  // Download client unavailable
  if (primary.status.toLowerCase() === 'downloadclientunavailable') {
    return {
      code: 'DOWNLOAD_CLIENT_UNAVAILABLE',
      label: `Blocked: Download client unavailable`,
      level: 'error',
      details,
    };
  }

  // Queued
  if (primary.status.toLowerCase() === 'queued') {
    return {
      code: 'QUEUED',
      label: `Queued${primary.downloadClient ? ` in ${primary.downloadClient}` : ''}`,
      level: 'normal',
    };
  }

  // Delay (waiting for better quality or cutoff)
  if (primary.status.toLowerCase() === 'delay') {
    return {
      code: 'DELAYED',
      label: 'Delayed - awaiting better quality',
      level: 'normal',
    };
  }

  // Importing
  if (primary.trackedDownloadState === 'importing') {
    return {
      code: 'IMPORTING',
      label: `${serverLabel}: Importing`,
      level: 'normal',
    };
  }

  // Import pending (completed download, waiting for import)
  if (primary.trackedDownloadState === 'importPending') {
    if (jellyfinScanRunning) {
      return {
        code: 'WAITING_LIBRARY_SCAN',
        label: 'Waiting for library scan',
        level: 'normal',
      };
    }

    return {
      code: 'IMPORT_PENDING',
      label: `${serverLabel}: Import pending`,
      level: 'normal',
    };
  }

  // Imported (download complete, imported)
  if (primary.trackedDownloadState === 'imported') {
    if (jellyfinScanRunning) {
      return {
        code: 'WAITING_LIBRARY_SCAN',
        label: 'Waiting for library scan',
        level: 'normal',
      };
    }

    return {
      code: 'IMPORTED_WAITING_SCAN',
      label: `${serverLabel}: Imported, waiting for scan`,
      level: 'normal',
    };
  }

  // Downloading - the common case
  if (
    primary.trackedDownloadState === 'downloading' ||
    primary.status.toLowerCase() === 'downloading'
  ) {
    const progress = formatProgress(primary);
    const clientLabel = primary.downloadClient || 'download client';

    if (downloadItems.length > 1) {
      const activeCount = downloadItems.filter(
        (i) =>
          i.trackedDownloadState === 'downloading' ||
          i.status.toLowerCase() === 'downloading'
      ).length;

      return {
        code: 'DOWNLOADING',
        label: `Downloading ${activeCount > 1 ? `${activeCount} items` : ''} via ${clientLabel}`,
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

  // Fallback for any tracked state
  if (primary.status && primary.status.toLowerCase() !== 'unknown') {
    return {
      code: 'PROCESSING',
      label: `${serverLabel}: ${primary.status}`,
      level: 'normal',
    };
  }

  return null;
}
