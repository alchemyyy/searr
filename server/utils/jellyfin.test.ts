import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJellyfinMediaURL } from '@server/utils/jellyfin';

describe('buildJellyfinMediaURL', () => {
  it('uses the current Jellyfin connection without forcing a server ID', () => {
    assert.strictEqual(
      buildJellyfinMediaURL('https://jellyfin.example.com/', 'item/id'),
      'https://jellyfin.example.com/web/#/details?id=item%2Fid'
    );
  });
});
