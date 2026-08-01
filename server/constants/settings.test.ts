import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS,
  getDownloadRefreshInterval,
  IDLE_DOWNLOAD_REFRESH_INTERVAL_MS,
  MAXIMUM_DOWNLOAD_REFRESH_INTERVAL_MS,
  MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS,
  normalizeDownloadRefreshInterval,
} from '@server/constants/settings';

describe('normalizeDownloadRefreshInterval', () => {
  it('uses the default for missing or invalid values', () => {
    assert.strictEqual(
      normalizeDownloadRefreshInterval(undefined),
      DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS
    );
    assert.strictEqual(
      normalizeDownloadRefreshInterval('not-a-number'),
      DEFAULT_DOWNLOAD_REFRESH_INTERVAL_MS
    );
  });

  it('clamps values to the supported range', () => {
    assert.strictEqual(
      normalizeDownloadRefreshInterval(0),
      MINIMUM_DOWNLOAD_REFRESH_INTERVAL_MS
    );
    assert.strictEqual(
      normalizeDownloadRefreshInterval(999_999),
      MAXIMUM_DOWNLOAD_REFRESH_INTERVAL_MS
    );
  });

  it('rounds values to whole seconds', () => {
    assert.strictEqual(normalizeDownloadRefreshInterval(1_499), 1_000);
    assert.strictEqual(normalizeDownloadRefreshInterval('1501'), 2_000);
  });
});

describe('getDownloadRefreshInterval', () => {
  it('uses the configured interval for active downloads', () => {
    assert.strictEqual(getDownloadRefreshInterval(true, 2_000), 2_000);
  });

  it('uses the idle floor when the configured interval is faster', () => {
    assert.strictEqual(
      getDownloadRefreshInterval(false, 2_000),
      IDLE_DOWNLOAD_REFRESH_INTERVAL_MS
    );
  });

  it('preserves slower configured intervals while idle', () => {
    assert.strictEqual(getDownloadRefreshInterval(false, 60_000), 60_000);
  });
});
