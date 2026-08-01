import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import SonarrAPI from '@server/api/servarr/sonarr';

function buildSonarr(): SonarrAPI {
  return new SonarrAPI({ url: 'http://localhost:8989/api/v3', apiKey: 'test' });
}

function getAxios(sonarr: SonarrAPI): AxiosInstance {
  return (sonarr as unknown as { axios: AxiosInstance }).axios;
}

describe('SonarrAPI manualImport', () => {
  afterEach(() => mock.restoreAll());

  it('queues automatically usable files with Sonarr command fields', async () => {
    const sonarr = buildSonarr();
    const get = mock.method(getAxios(sonarr), 'get', async () => ({
      data: [
        {
          path: 'C:\\downloads\\Series.S01E01.mkv',
          folderName: 'Series.S01E01',
          size: 1024,
          series: { id: 23 },
          seasonNumber: 1,
          episodes: [{ id: 45 }],
          episodeFileId: 67,
          quality: { quality: { id: 4, name: 'HDTV-1080p' } },
          languages: [{ id: 1, name: 'English' }],
          releaseGroup: 'GROUP',
          indexerFlags: 2,
          releaseType: 'singleEpisode',
          downloadId: 'stale-download-id',
        },
        {
          path: 'C:\\downloads\\sample.mkv',
          folderName: 'Series.S01E01',
          size: 0,
          series: { id: 23 },
          seasonNumber: 1,
          episodes: [{ id: 45 }],
          quality: { quality: { id: 4, name: 'HDTV-1080p' } },
          languages: [{ id: 1, name: 'English' }],
        },
      ],
    }));
    const post = mock.method(getAxios(sonarr), 'post', async () => ({}));

    const fileCount = await sonarr.manualImport('current-download-id');

    assert.strictEqual(fileCount, 1);
    assert.strictEqual(get.mock.calls[0].arguments[0], '/manualimport');
    assert.deepStrictEqual(get.mock.calls[0].arguments[1], {
      params: {
        downloadId: 'current-download-id',
        filterExistingFiles: true,
      },
    });
    assert.deepStrictEqual(post.mock.calls[0].arguments[1], {
      name: 'ManualImport',
      files: [
        {
          path: 'C:\\downloads\\Series.S01E01.mkv',
          folderName: 'Series.S01E01',
          seriesId: 23,
          episodeIds: [45],
          episodeFileId: 67,
          releaseGroup: 'GROUP',
          quality: { quality: { id: 4, name: 'HDTV-1080p' } },
          languages: [{ id: 1, name: 'English' }],
          indexerFlags: 2,
          releaseType: 'singleEpisode',
          downloadId: 'current-download-id',
        },
      ],
      importMode: 'auto',
    });
  });

  it('does not queue a command when Sonarr cannot identify an episode', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({
      data: [
        {
          path: 'C:\\downloads\\unknown.mkv',
          folderName: 'Unknown',
          size: 1024,
          series: { id: 23 },
          seasonNumber: 1,
          episodes: [],
          quality: { quality: { id: 4, name: 'HDTV-1080p' } },
          languages: [{ id: 1, name: 'English' }],
        },
      ],
    }));
    const post = mock.method(getAxios(sonarr), 'post', async () => ({}));

    const fileCount = await sonarr.manualImport('download-id');

    assert.strictEqual(fileCount, 0);
    assert.strictEqual(post.mock.callCount(), 0);
  });
});

describe('SonarrAPI removeSeries', () => {
  afterEach(() => mock.restoreAll());

  it('removes the series when it exists in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await sonarr.removeSeries(1234);

    assert.strictEqual(del.mock.callCount(), 1);
    assert.strictEqual(del.mock.calls[0].arguments[0], '/series/9');
  });

  it('does nothing when the series is not in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({
      data: [{ id: 0, title: 'Breaking Bad' }],
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('rejects when the tvdbId is unknown to the lookup', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(() => sonarr.removeSeries(1234), /Series not found/);
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('ignores a 404 when the series was already removed in Sonarr', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 404 } };
    });

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
  });

  it('rethrows errors other than 404', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 500 } };
    });

    await assert.rejects(() => sonarr.removeSeries(1234));
  });

  it('rethrows a 404 from the lookup instead of treating it as removed', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 404 } };
    });
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(
      () => sonarr.removeSeries(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 404
    );
    assert.strictEqual(del.mock.callCount(), 0);
  });
});

describe('SonarrAPI getSeriesByTvdbId', () => {
  afterEach(() => mock.restoreAll());

  it('rethrows a 401 from the lookup with the status intact', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 401 } };
    });

    await assert.rejects(
      () => sonarr.getSeriesByTvdbId(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 401
    );
  });

  it('throws "Series not found" when the lookup returns no results', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));

    await assert.rejects(() => sonarr.getSeriesByTvdbId(1234), {
      message: 'Series not found',
    });
  });
});
