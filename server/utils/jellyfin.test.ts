import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { JellyfinLibraryItem } from '@server/api/jellyfin';
import {
  buildJellyfinMediaURL,
  findJellyfinEpisode,
} from '@server/utils/jellyfin';

describe('buildJellyfinMediaURL', () => {
  it('uses the current Jellyfin connection without forcing a server ID', () => {
    assert.strictEqual(
      buildJellyfinMediaURL('https://jellyfin.example.com/', 'item/id'),
      'https://jellyfin.example.com/web/#/details?id=item%2Fid'
    );
  });

  it('includes the episode server ID when Jellyfin provides it', () => {
    assert.strictEqual(
      buildJellyfinMediaURL(
        'https://jellyfin.example.com',
        'episode-id',
        'server-id'
      ),
      'https://jellyfin.example.com/web/#/details?id=episode-id&serverId=server-id'
    );
  });
});

describe('findJellyfinEpisode', () => {
  it('finds exact and combined episode entries', () => {
    const episodes: JellyfinLibraryItem[] = [
      {
        Name: 'First Episode',
        Id: 'episode-1',
        HasSubtitles: false,
        Type: 'Episode',
        LocationType: 'FileSystem',
        MediaType: 'Video',
        ParentIndexNumber: 2,
        IndexNumber: 1,
      },
      {
        Name: 'Combined Episode',
        Id: 'episode-2-3',
        HasSubtitles: false,
        Type: 'Episode',
        LocationType: 'FileSystem',
        MediaType: 'Video',
        ParentIndexNumber: 2,
        IndexNumber: 2,
        IndexNumberEnd: 3,
      },
    ];

    assert.strictEqual(findJellyfinEpisode(episodes, 2, 1)?.Id, 'episode-1');
    assert.strictEqual(findJellyfinEpisode(episodes, 2, 3)?.Id, 'episode-2-3');
    assert.strictEqual(findJellyfinEpisode(episodes, 1, 1), undefined);
  });
});
