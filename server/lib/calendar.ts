import RadarrAPI, { type RadarrMovie } from '@server/api/servarr/radarr';
import SonarrAPI, { type EpisodeResult } from '@server/api/servarr/sonarr';
import {
  CalendarMediaFilter,
  CalendarMediaItemType,
  type CalendarMediaItem,
} from '@server/constants/calendar';
import type {
  DVRSettings,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import logger from '@server/logger';

const getServerKey = (server: DVRSettings): string => {
  const normalizedBaseURL = (server.baseUrl ?? '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  return JSON.stringify([
    server.useSsl,
    server.hostname.toLowerCase(),
    server.port,
    normalizedBaseURL,
  ]);
};

const getUniqueServerSettings = <T extends DVRSettings>(
  serverSettings: T[]
): T[] => {
  const serverKeys: Set<string> = new Set<string>();
  const uniqueServerSettings: T[] = [];

  for (const server of serverSettings) {
    const serverKey = getServerKey(server);

    if (serverKeys.has(serverKey)) {
      continue;
    }

    serverKeys.add(serverKey);
    uniqueServerSettings.push(server);
  }

  return uniqueServerSettings;
};

const getCalendarItemKey = (item: CalendarMediaItem): string => {
  switch (item.type) {
    case CalendarMediaItemType.TvShow:
      return JSON.stringify([
        item.type,
        item.tvdbId ?? item.tmdbId ?? item.seriesTitle ?? item.title,
        item.seasonNumber,
        item.episodeNumber,
      ]);
    case CalendarMediaItemType.Movie:
      return JSON.stringify([
        item.type,
        item.tmdbId ?? [item.title, item.releaseDate ?? item.date],
      ]);
  }
};

export const deduplicateCalendarItems = (
  items: CalendarMediaItem[]
): CalendarMediaItem[] => {
  const uniqueItemsByKey: Map<string, CalendarMediaItem> = new Map<
    string,
    CalendarMediaItem
  >();

  for (const item of items) {
    const itemKey = getCalendarItemKey(item);
    const existingItem = uniqueItemsByKey.get(itemKey);

    if (!existingItem) {
      uniqueItemsByKey.set(itemKey, { ...item });
      continue;
    }

    uniqueItemsByKey.set(itemKey, {
      ...existingItem,
      hasFile: existingItem.hasFile === true || item.hasFile === true,
    });
  }

  return [...uniqueItemsByKey.values()].sort(
    (firstItem, secondItem): number => {
      const firstDate = firstItem.airDateUtc ?? firstItem.date;
      const secondDate = secondItem.airDateUtc ?? secondItem.date;
      const dateComparison = firstDate.localeCompare(secondDate);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return firstItem.title.localeCompare(secondItem.title);
    }
  );
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class Calendar {
  public async getSonarrCalendarEvents(
    sonarrSettings: SonarrSettings[],
    startDate: string,
    endDate: string
  ): Promise<CalendarMediaItem[]> {
    const uniqueServerSettings = getUniqueServerSettings(sonarrSettings);
    const serverResults: CalendarMediaItem[][] = await Promise.all(
      uniqueServerSettings.map(async (server): Promise<CalendarMediaItem[]> => {
        try {
          const sonarr = new SonarrAPI({
            url: SonarrAPI.buildUrl(server, '/api/v3'),
            apiKey: server.apiKey,
          });
          const episodes: EpisodeResult[] = await sonarr.getCalendarByDate(
            startDate,
            endDate
          );
          const results: CalendarMediaItem[] = [];

          for (const episode of episodes) {
            if (!episode.airDate) {
              continue;
            }

            results.push({
              title: episode.series?.title ?? episode.title,
              type: CalendarMediaItemType.TvShow,
              date: episode.airDate,
              tmdbId: episode.series?.tmdbId,
              tvdbId: episode.series?.tvdbId,
              seriesTitle: episode.series?.title,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeTitle: episode.title,
              overview: episode.overview,
              airDateUtc: episode.airDateUtc,
              runtime: episode.runtime ?? episode.series?.runtime,
              hasFile: episode.hasFile,
              finaleType: episode.finaleType,
            });
          }

          return results;
        } catch (error) {
          logger.warn('Failed to fetch calendar from Sonarr server', {
            label: 'Calendar',
            serverName: server.name,
            errorMessage: getErrorMessage(error),
          });
          return [];
        }
      })
    );

    return serverResults.flat();
  }

  public async getRadarrCalendarEvents(
    radarrSettings: RadarrSettings[],
    startDate: string,
    endDate: string
  ): Promise<CalendarMediaItem[]> {
    const uniqueServerSettings = getUniqueServerSettings(radarrSettings);
    const serverResults: CalendarMediaItem[][] = await Promise.all(
      uniqueServerSettings.map(async (server): Promise<CalendarMediaItem[]> => {
        try {
          const radarr = new RadarrAPI({
            url: RadarrAPI.buildUrl(server, '/api/v3'),
            apiKey: server.apiKey,
          });
          const movies: RadarrMovie[] = await radarr.getCalendarByDate(
            startDate,
            endDate
          );
          const results: CalendarMediaItem[] = [];

          for (const movie of movies) {
            if (!movie.releaseDate) {
              continue;
            }

            results.push({
              title: movie.title,
              type: CalendarMediaItemType.Movie,
              date: movie.releaseDate,
              tmdbId: movie.tmdbId,
              overview: movie.overview,
              releaseDate: movie.releaseDate,
              runtime: movie.runtime,
              hasFile: movie.hasFile,
            });
          }

          return results;
        } catch (error) {
          logger.warn('Failed to fetch calendar from Radarr server', {
            label: 'Calendar',
            serverName: server.name,
            errorMessage: getErrorMessage(error),
          });
          return [];
        }
      })
    );

    return serverResults.flat();
  }

  public async getCombinedEvents(
    radarrSettings: RadarrSettings[],
    sonarrSettings: SonarrSettings[],
    filter: CalendarMediaFilter,
    startDate: string,
    endDate: string
  ): Promise<CalendarMediaItem[]> {
    const promises: Promise<CalendarMediaItem[]>[] = [];

    if (
      filter === CalendarMediaFilter.All ||
      filter === CalendarMediaFilter.TvShows
    ) {
      if (sonarrSettings.length > 0) {
        promises.push(
          this.getSonarrCalendarEvents(sonarrSettings, startDate, endDate)
        );
      }
    }

    if (
      filter === CalendarMediaFilter.All ||
      filter === CalendarMediaFilter.Movies
    ) {
      if (radarrSettings.length > 0) {
        promises.push(
          this.getRadarrCalendarEvents(radarrSettings, startDate, endDate)
        );
      }
    }

    const results: CalendarMediaItem[][] = await Promise.all(promises);
    return deduplicateCalendarItems(results.flat());
  }
}
