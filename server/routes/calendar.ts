import JellyfinAPI, { type JellyfinLibraryItem } from '@server/api/jellyfin';
import {
  CalendarMediaFilter,
  CalendarMediaItemType,
} from '@server/constants/calendar';
import { MediaServerType } from '@server/constants/server';
import Media from '@server/entity/Media';
import { Calendar } from '@server/lib/calendar';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';
import {
  buildJellyfinMediaURL,
  findJellyfinEpisode,
} from '@server/utils/jellyfin';
import { Router } from 'express';

const calendarRoutes = Router();

calendarRoutes.get<{
  filter: string;
  startDate: string;
  endDate: string;
}>('/:filter/:startDate/:endDate', async (req, res, next) => {
  const { filter, startDate, endDate } = req.params;

  const validFilters = Object.values(CalendarMediaFilter) as string[];
  if (!validFilters.includes(filter)) {
    return next({
      status: 400,
      message: `Invalid filter: ${filter}. Must be one of: ${validFilters.join(', ')}`,
    });
  }

  if (startDate > endDate) {
    return next({
      status: 400,
      message: 'The calendar start date must not be after the end date.',
    });
  }

  try {
    const settings = getSettings();
    const calendar = new Calendar();

    const events = await calendar.getCombinedEvents(
      settings.radarr,
      settings.sonarr,
      filter as CalendarMediaFilter,
      startDate,
      endDate
    );

    if (settings.main.mediaServerType === MediaServerType.JELLYFIN) {
      const availableMediaItems: { tmdbId: number; mediaType: string }[] = [];

      for (const event of events) {
        if (event.hasFile && event.tmdbId !== undefined) {
          availableMediaItems.push({
            tmdbId: event.tmdbId,
            mediaType: event.type,
          });
        }
      }

      const relatedMedia: Media[] = await Media.getRelatedMedia(
        req.user,
        availableMediaItems
      );
      const relatedMediaByKey: Map<string, Media> = new Map<string, Media>();
      const episodesBySeriesID: Map<
        string,
        Promise<JellyfinLibraryItem[]>
      > = new Map<string, Promise<JellyfinLibraryItem[]>>();
      const jellyfinClient = new JellyfinAPI(
        getHostname(),
        settings.jellyfin.apiKey
      );
      const jellyfinHost = settings.jellyfin.externalHostname || getHostname();

      const getJellyfinEpisodes = (
        seriesID: string
      ): Promise<JellyfinLibraryItem[]> => {
        let episodesPromise = episodesBySeriesID.get(seriesID);

        if (!episodesPromise) {
          episodesPromise = jellyfinClient
            .getEpisodes(seriesID)
            .catch((): JellyfinLibraryItem[] => []);
          episodesBySeriesID.set(seriesID, episodesPromise);
        }

        return episodesPromise;
      };

      for (const media of relatedMedia) {
        relatedMediaByKey.set(
          JSON.stringify([media.mediaType, media.tmdbId]),
          media
        );
      }

      const episodeLinkPromises: Promise<void>[] = [];

      for (const event of events) {
        if (!event.hasFile || event.tmdbId === undefined) {
          continue;
        }

        const media = relatedMediaByKey.get(
          JSON.stringify([event.type, event.tmdbId])
        );

        if (!media) {
          continue;
        }

        if (event.type === CalendarMediaItemType.Movie) {
          event.jellyfinUrl = media.mediaUrl ?? media.mediaUrl4k;
          continue;
        }

        const seasonNumber = event.seasonNumber;
        const episodeNumber = event.episodeNumber;

        if (seasonNumber === undefined || episodeNumber === undefined) {
          continue;
        }

        episodeLinkPromises.push(
          (async (): Promise<void> => {
            const seriesIDs: string[] = [];

            if (media.jellyfinMediaId) {
              seriesIDs.push(media.jellyfinMediaId);
            }
            if (
              media.jellyfinMediaId4k &&
              media.jellyfinMediaId4k !== media.jellyfinMediaId
            ) {
              seriesIDs.push(media.jellyfinMediaId4k);
            }

            for (const seriesID of seriesIDs) {
              const episodes = await getJellyfinEpisodes(seriesID);
              const episode = findJellyfinEpisode(
                episodes,
                seasonNumber,
                episodeNumber
              );

              if (episode) {
                event.jellyfinUrl = buildJellyfinMediaURL(
                  jellyfinHost,
                  episode.Id,
                  episode.ServerId
                );
                return;
              }
            }
          })()
        );
      }

      await Promise.all(episodeLinkPromises);
    }

    return res.status(200).json(events);
  } catch (error) {
    logger.error('Failed to retrieve calendar events', {
      label: 'Calendar API',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return next({
      status: 500,
      message: 'Unable to retrieve calendar events.',
    });
  }
});

export default calendarRoutes;
