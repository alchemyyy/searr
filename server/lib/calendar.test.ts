import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CalendarMediaItemType,
  type CalendarMediaItem,
} from '@server/constants/calendar';
import { deduplicateCalendarItems } from '@server/lib/calendar';

describe('deduplicateCalendarItems', () => {
  it('merges duplicate episodes and preserves an available copy', () => {
    const items: CalendarMediaItem[] = [
      {
        title: 'Example Series',
        type: CalendarMediaItemType.TvShow,
        date: '2026-08-03',
        tvdbId: 100,
        seasonNumber: 2,
        episodeNumber: 4,
        hasFile: false,
      },
      {
        title: 'Example Series',
        type: CalendarMediaItemType.TvShow,
        date: '2026-08-03',
        tvdbId: 100,
        seasonNumber: 2,
        episodeNumber: 4,
        hasFile: true,
      },
    ];

    const result = deduplicateCalendarItems(items);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].hasFile, true);
  });

  it('keeps separate episodes from the same series', () => {
    const items: CalendarMediaItem[] = [
      {
        title: 'Example Series',
        type: CalendarMediaItemType.TvShow,
        date: '2026-08-03',
        tvdbId: 100,
        seasonNumber: 2,
        episodeNumber: 4,
      },
      {
        title: 'Example Series',
        type: CalendarMediaItemType.TvShow,
        date: '2026-08-10',
        tvdbId: 100,
        seasonNumber: 2,
        episodeNumber: 5,
      },
    ];

    assert.strictEqual(deduplicateCalendarItems(items).length, 2);
  });

  it('merges the same movie reported by multiple Radarr servers', () => {
    const items: CalendarMediaItem[] = [
      {
        title: 'Example Movie',
        type: CalendarMediaItemType.Movie,
        date: '2026-08-01',
        releaseDate: '2026-08-01',
        tmdbId: 200,
      },
      {
        title: 'Example Movie',
        type: CalendarMediaItemType.Movie,
        date: '2026-08-15',
        releaseDate: '2026-08-15',
        tmdbId: 200,
      },
    ];

    assert.strictEqual(deduplicateCalendarItems(items).length, 1);
  });

  it('sorts events chronologically and then by title', () => {
    const items: CalendarMediaItem[] = [
      {
        title: 'Zulu',
        type: CalendarMediaItemType.Movie,
        date: '2026-08-02',
      },
      {
        title: 'Bravo',
        type: CalendarMediaItemType.Movie,
        date: '2026-08-01',
      },
      {
        title: 'Alpha',
        type: CalendarMediaItemType.Movie,
        date: '2026-08-01',
      },
    ];

    const result = deduplicateCalendarItems(items);

    assert.deepStrictEqual(
      result.map((item) => item.title),
      ['Alpha', 'Bravo', 'Zulu']
    );
  });
});
