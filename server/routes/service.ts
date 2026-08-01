import { isManualImportRequired } from '@server/api/servarr/base';
import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type {
  ServiceCommonServer,
  ServiceCommonServerWithDetails,
} from '@server/interfaces/api/serviceInterfaces';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const serviceRoutes = Router();
const MAX_DOWNLOAD_ID_LENGTH = 512;

interface ManualImportRequestBody {
  downloadId?: string;
}

interface ManualImportResponse {
  queued: boolean;
  fileCount: number;
}

serviceRoutes.get('/radarr', async (req, res) => {
  const settings = getSettings();

  const filteredRadarrServers: ServiceCommonServer[] = settings.radarr.map(
    (radarr) => ({
      id: radarr.id,
      name: radarr.name,
      is4k: radarr.is4k,
      isDefault: radarr.isDefault,
      activeDirectory: radarr.activeDirectory,
      activeProfileId: radarr.activeProfileId,
      activeTags: radarr.tags ?? [],
    })
  );

  return res.status(200).json(filteredRadarrServers);
});

serviceRoutes.get<{ radarrId: string }>(
  '/radarr/:radarrId',
  async (req, res, next) => {
    const settings = getSettings();

    const radarrSettings = settings.radarr.find(
      (radarr) => radarr.id === Number(req.params.radarrId)
    );

    if (!radarrSettings) {
      return next({
        status: 404,
        message: 'Radarr server with provided ID  does not exist.',
      });
    }

    const radarr = new RadarrAPI({
      apiKey: radarrSettings.apiKey,
      url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
    });

    const profiles = await radarr.getProfiles();
    const rootFolders = await radarr.getRootFolders();
    const tags = await radarr.getTags();

    return res.status(200).json({
      server: {
        id: radarrSettings.id,
        name: radarrSettings.name,
        is4k: radarrSettings.is4k,
        isDefault: radarrSettings.isDefault,
        activeDirectory: radarrSettings.activeDirectory,
        activeProfileId: radarrSettings.activeProfileId,
        activeTags: radarrSettings.tags,
      },
      profiles: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
      })),
      rootFolders: rootFolders.map((folder) => ({
        id: folder.id,
        freeSpace: folder.freeSpace,
        path: folder.path,
        totalSpace: folder.totalSpace,
      })),
      tags,
    } as ServiceCommonServerWithDetails);
  }
);

serviceRoutes.post<
  { radarrId: string },
  ManualImportResponse,
  ManualImportRequestBody
>(
  '/radarr/:radarrId/manual-import',
  isAuthenticated(Permission.MANUAL_IMPORT),
  async (req, res, next) => {
    const downloadID =
      typeof req.body.downloadId === 'string' ? req.body.downloadId.trim() : '';

    if (!downloadID || downloadID.length > MAX_DOWNLOAD_ID_LENGTH) {
      return next({ status: 400, message: 'A valid download ID is required.' });
    }

    const settings = getSettings();
    const radarrSettings = settings.radarr.find(
      (radarr) => radarr.id === Number(req.params.radarrId)
    );

    if (!radarrSettings) {
      return next({
        status: 404,
        message: 'Radarr server with provided ID does not exist.',
      });
    }

    const radarr = new RadarrAPI({
      apiKey: radarrSettings.apiKey,
      url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
    });

    try {
      const queueItems = await radarr.getQueue();
      const queueItem = queueItems.find(
        (item) => item.downloadId === downloadID
      );

      if (!queueItem) {
        return next({
          status: 404,
          message: 'Download is no longer present in the Radarr queue.',
        });
      }

      if (!isManualImportRequired(queueItem)) {
        return next({
          status: 409,
          message: 'Download is not ready for manual import.',
        });
      }

      const fileCount = await radarr.manualImport(downloadID);

      if (fileCount === 0) {
        return next({
          status: 409,
          message:
            'No automatically importable files were found. A Radarr administrator must complete the import.',
        });
      }

      logger.info('User queued a Radarr manual import', {
        label: 'Radarr API',
        downloadId: downloadID,
        fileCount,
        serverId: radarrSettings.id,
        userId: req.user?.id,
      });

      return res.status(202).json({ queued: true, fileCount });
    } catch (e) {
      logger.error('Failed to queue a Radarr manual import', {
        label: 'Radarr API',
        downloadId: downloadID,
        errorMessage: e.message,
        serverId: radarrSettings.id,
        userId: req.user?.id,
      });

      return next({
        status: 502,
        message: 'Failed to queue manual import in Radarr.',
      });
    }
  }
);

serviceRoutes.get('/sonarr', async (req, res) => {
  const settings = getSettings();

  const filteredSonarrServers: ServiceCommonServer[] = settings.sonarr.map(
    (sonarr) => ({
      id: sonarr.id,
      name: sonarr.name,
      is4k: sonarr.is4k,
      isDefault: sonarr.isDefault,
      activeDirectory: sonarr.activeDirectory,
      activeProfileId: sonarr.activeProfileId,
      activeAnimeProfileId: sonarr.activeAnimeProfileId,
      activeAnimeDirectory: sonarr.activeAnimeDirectory,
      activeLanguageProfileId: sonarr.activeLanguageProfileId,
      activeAnimeLanguageProfileId: sonarr.activeAnimeLanguageProfileId,
      activeTags: [],
    })
  );

  return res.status(200).json(filteredSonarrServers);
});

serviceRoutes.get<{ sonarrId: string }>(
  '/sonarr/:sonarrId',
  async (req, res, next) => {
    const settings = getSettings();

    const sonarrSettings = settings.sonarr.find(
      (sonarr) => sonarr.id === Number(req.params.sonarrId)
    );

    if (!sonarrSettings) {
      return next({
        status: 404,
        message: 'Sonarr server with provided ID does not exist.',
      });
    }

    const sonarr = new SonarrAPI({
      apiKey: sonarrSettings.apiKey,
      url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
    });

    try {
      const systemStatus = await sonarr.getSystemStatus();
      const sonarrMajorVersion = Number(systemStatus.version.split('.')[0]);

      const profiles = await sonarr.getProfiles();
      const rootFolders = await sonarr.getRootFolders();
      const languageProfiles =
        sonarrMajorVersion <= 3 ? await sonarr.getLanguageProfiles() : null;
      const tags = await sonarr.getTags();

      return res.status(200).json({
        server: {
          id: sonarrSettings.id,
          name: sonarrSettings.name,
          is4k: sonarrSettings.is4k,
          isDefault: sonarrSettings.isDefault,
          activeDirectory: sonarrSettings.activeDirectory,
          activeProfileId: sonarrSettings.activeProfileId,
          activeAnimeProfileId: sonarrSettings.activeAnimeProfileId,
          activeAnimeDirectory: sonarrSettings.activeAnimeDirectory,
          activeLanguageProfileId: sonarrSettings.activeLanguageProfileId,
          activeAnimeLanguageProfileId:
            sonarrSettings.activeAnimeLanguageProfileId,
          activeTags: sonarrSettings.tags,
          activeAnimeTags: sonarrSettings.animeTags,
        },
        profiles: profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
        })),
        rootFolders: rootFolders.map((folder) => ({
          id: folder.id,
          freeSpace: folder.freeSpace,
          path: folder.path,
          totalSpace: folder.totalSpace,
        })),
        languageProfiles: languageProfiles,
        tags,
      } as ServiceCommonServerWithDetails);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

serviceRoutes.post<
  { sonarrId: string },
  ManualImportResponse,
  ManualImportRequestBody
>(
  '/sonarr/:sonarrId/manual-import',
  isAuthenticated(Permission.MANUAL_IMPORT),
  async (req, res, next) => {
    const downloadID =
      typeof req.body.downloadId === 'string' ? req.body.downloadId.trim() : '';

    if (!downloadID || downloadID.length > MAX_DOWNLOAD_ID_LENGTH) {
      return next({ status: 400, message: 'A valid download ID is required.' });
    }

    const settings = getSettings();
    const sonarrSettings = settings.sonarr.find(
      (sonarr) => sonarr.id === Number(req.params.sonarrId)
    );

    if (!sonarrSettings) {
      return next({
        status: 404,
        message: 'Sonarr server with provided ID does not exist.',
      });
    }

    const sonarr = new SonarrAPI({
      apiKey: sonarrSettings.apiKey,
      url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
    });

    try {
      const queueItems = await sonarr.getQueue();
      const queueItem = queueItems.find(
        (item) => item.downloadId === downloadID
      );

      if (!queueItem) {
        return next({
          status: 404,
          message: 'Download is no longer present in the Sonarr queue.',
        });
      }

      if (!isManualImportRequired(queueItem)) {
        return next({
          status: 409,
          message: 'Download is not ready for manual import.',
        });
      }

      const fileCount = await sonarr.manualImport(downloadID);

      if (fileCount === 0) {
        return next({
          status: 409,
          message:
            'No automatically importable files were found. A Sonarr administrator must complete the import.',
        });
      }

      logger.info('User queued a Sonarr manual import', {
        label: 'Sonarr API',
        downloadId: downloadID,
        fileCount,
        serverId: sonarrSettings.id,
        userId: req.user?.id,
      });

      return res.status(202).json({ queued: true, fileCount });
    } catch (e) {
      logger.error('Failed to queue a Sonarr manual import', {
        label: 'Sonarr API',
        downloadId: downloadID,
        errorMessage: e.message,
        serverId: sonarrSettings.id,
        userId: req.user?.id,
      });

      return next({
        status: 502,
        message: 'Failed to queue manual import in Sonarr.',
      });
    }
  }
);

serviceRoutes.get<{ tmdbId: string }>(
  '/sonarr/lookup/:tmdbId',
  async (req, res, next) => {
    const settings = getSettings();
    const tmdb = new TheMovieDb();

    const sonarrSettings = settings.sonarr[0];

    if (!sonarrSettings) {
      logger.error('No sonarr server has been setup', {
        label: 'Media Request',
      });
      return next({
        status: 404,
        message: 'No sonarr server has been setup',
      });
    }

    const sonarr = new SonarrAPI({
      apiKey: sonarrSettings.apiKey,
      url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
    });

    try {
      const tv = await tmdb.getTvShow({
        tvId: Number(req.params.tmdbId),
        language: 'en',
      });

      const response = await sonarr.getSeriesByTitle(tv.name);

      return res.status(200).json(response);
    } catch (e) {
      logger.error('Failed to fetch tvdb search results', {
        label: 'Media Request',
        message: e.message,
      });

      return next({
        status: 500,
        message: 'Something went wrong trying to fetch series information',
      });
    }
  }
);

export default serviceRoutes;
