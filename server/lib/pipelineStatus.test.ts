import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HealthCheckResult } from '@server/api/servarr/base';
import { MediaStatus, MediaType } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import { computePipelineStatus } from '@server/lib/pipelineStatus';

const createDownloadItem = (
  overrides: Partial<DownloadingItem> = {}
): DownloadingItem => ({
  mediaType: MediaType.MOVIE,
  externalId: 1,
  size: 100,
  sizeLeft: 50,
  status: 'downloading',
  timeLeft: '00:01:00',
  estimatedCompletionTime: new Date('2026-01-01T00:01:00.000Z'),
  title: 'Example',
  downloadId: 'download-1',
  trackedDownloadStatus: 'ok',
  trackedDownloadState: 'downloading',
  downloadClient: 'SABnzbd',
  protocol: 'usenet',
  indexer: 'Example Indexer',
  statusMessages: [],
  ...overrides,
});

describe('computePipelineStatus', () => {
  it('ignores completed media without active downloads', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.AVAILABLE,
      downloadItems: [],
      healthChecks: [],
      jellyfinScanRunning: false,
      serverType: 'radarr',
    });

    assert.strictEqual(status, null);
  });

  it('reports a download client outage before searching', () => {
    const healthChecks: HealthCheckResult[] = [
      {
        source: 'DownloadClientCheck',
        type: 'error',
        message: 'No download client is available',
      },
    ];
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [],
      healthChecks,
      jellyfinScanRunning: false,
      serverType: 'sonarr',
    });

    assert.strictEqual(status?.code, 'BLOCKED_NO_DOWNLOAD_CLIENT');
    assert.strictEqual(status?.details, healthChecks[0].message);
  });

  it('does not treat an individual indexer warning as a total outage', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [],
      healthChecks: [
        {
          source: 'IndexerStatusCheck',
          type: 'warning',
          message: 'One indexer is unavailable',
        },
      ],
      jellyfinScanRunning: false,
      serverType: 'sonarr',
    });

    assert.strictEqual(status?.code, 'SEARCHING');
  });

  it('reports a total indexer outage', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [],
      healthChecks: [
        {
          source: 'IndexerStatusCheck',
          type: 'error',
          message: 'All indexers are unavailable',
        },
      ],
      jellyfinScanRunning: false,
      serverType: 'sonarr',
    });

    assert.strictEqual(status?.code, 'BLOCKED_NO_INDEXERS');
  });

  it('formats and clamps active download progress', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [createDownloadItem({ sizeLeft: -10 })],
      healthChecks: [],
      jellyfinScanRunning: false,
      serverType: 'radarr',
    });

    assert.strictEqual(status?.code, 'DOWNLOADING');
    assert.strictEqual(status?.progress, 100);
    assert.strictEqual(status?.label, 'Downloading via SABnzbd (100%)');
  });

  it('prioritizes a failed item over concurrent downloads', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [
        createDownloadItem(),
        createDownloadItem({
          downloadId: 'download-2',
          trackedDownloadState: 'failed',
        }),
      ],
      healthChecks: [],
      jellyfinScanRunning: false,
      serverType: 'radarr',
    });

    assert.strictEqual(status?.code, 'DOWNLOAD_FAILED');
  });

  it('reports the number of concurrent downloads without malformed spacing', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [
        createDownloadItem(),
        createDownloadItem({ downloadId: 'download-2' }),
      ],
      healthChecks: [],
      jellyfinScanRunning: false,
      serverType: 'radarr',
    });

    assert.strictEqual(status?.label, 'Downloading 2 items via SABnzbd');
  });

  it('reports an active Jellyfin scan after the Servarr queue clears', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [],
      healthChecks: [],
      jellyfinScanRunning: true,
      serverType: 'sonarr',
    });

    assert.strictEqual(status?.code, 'WAITING_LIBRARY_SCAN');
  });

  it('keeps import-pending items attributed to Servarr', () => {
    const status = computePipelineStatus({
      mediaStatus: MediaStatus.PROCESSING,
      downloadItems: [
        createDownloadItem({ trackedDownloadState: 'importPending' }),
      ],
      healthChecks: [],
      jellyfinScanRunning: true,
      serverType: 'sonarr',
    });

    assert.strictEqual(status?.code, 'IMPORT_PENDING');
  });
});
