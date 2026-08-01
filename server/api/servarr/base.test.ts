import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isManualImportRequired } from '@server/api/servarr/base';

describe('isManualImportRequired', () => {
  it('only accepts completed downloads with an import warning', () => {
    assert.strictEqual(
      isManualImportRequired({
        status: 'completed',
        trackedDownloadStatus: 'warning',
      }),
      true
    );
    assert.strictEqual(
      isManualImportRequired({
        status: 'downloading',
        trackedDownloadStatus: 'warning',
      }),
      false
    );
    assert.strictEqual(
      isManualImportRequired({
        status: 'completed',
        trackedDownloadStatus: 'error',
      }),
      false
    );
  });
});
