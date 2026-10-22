import TheMovieDb from '@server/api/themoviedb';
import Tvdb from '@server/api/tvdb';
import { MediaType } from '@server/constants/media';
import dataSource, { getRepository } from '@server/datasource';
import BackendSelectionRule, {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagProvider,
  MetadataTagType,
  type MetadataTagReference,
} from '@server/entity/BackendSelectionRule';
import type {
  BackendSelectionRecommendationResponse,
  MetadataTagCatalogEntry,
} from '@server/interfaces/api/backendSelectionInterfaces';
import { selectBackendForMetadata } from '@server/lib/backendSelection';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { In } from 'typeorm';
import { z } from 'zod';

const mediaTypeSchema = z.enum([MediaType.MOVIE, MediaType.TV]);
const metadataTagSchema = z.strictObject({
  provider: z.enum([MetadataTagProvider.TMDB, MetadataTagProvider.TVDB]),
  type: z.literal(MetadataTagType.GENRE),
  id: z.number().int().nonnegative(),
});
const ruleValuesSchema = z.strictObject({
  mediaType: mediaTypeSchema,
  serviceId: z.number().int().nonnegative(),
  ruleType: z.enum([
    BackendSelectionRuleType.ALLOW,
    BackendSelectionRuleType.BLOCK,
  ]),
  matchType: z.enum([
    BackendSelectionMatchType.ANY,
    BackendSelectionMatchType.ALL,
  ]),
  tags: z.array(metadataTagSchema).min(1).max(100),
});
const recommendationSchema = z.strictObject({
  mediaType: mediaTypeSchema,
  is4k: z.boolean(),
  tags: z.array(metadataTagSchema).max(200),
});
const reorderSchema = z.strictObject({
  ruleIds: z.array(z.number().int().positive()),
});
const ruleIdSchema = z.coerce.number().int().positive();

const deduplicateTags = (
  tags: MetadataTagReference[]
): MetadataTagReference[] => {
  const tagsByKey = new Map<string, MetadataTagReference>();
  tags.forEach((tag) => {
    tagsByKey.set(`${tag.provider}:${tag.type}:${tag.id}`, tag);
  });
  return [...tagsByKey.values()];
};

const serviceExists = (mediaType: MediaType, serviceId: number): boolean => {
  const settings = getSettings();

  switch (mediaType) {
    case MediaType.MOVIE:
      return settings.radarr.some((service) => service.id === serviceId);
    case MediaType.TV:
      return settings.sonarr.some((service) => service.id === serviceId);
  }
};

const backendSelectionRoutes = Router();

backendSelectionRoutes.get(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (_request, response, next) => {
    try {
      const rules = await getRepository(BackendSelectionRule).find({
        order: { mediaType: 'ASC', position: 'ASC', id: 'ASC' },
      });
      return response.status(200).json(rules);
    } catch (error) {
      logger.error('Unable to retrieve backend selection rules', {
        label: 'Backend Selection',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve backend selection rules.',
      });
    }
  }
);

backendSelectionRoutes.get(
  '/tags',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const mediaType = mediaTypeSchema.parse(request.query.mediaType);
      const tmdb = new TheMovieDb();
      const tmdbGenres =
        mediaType === MediaType.MOVIE
          ? await tmdb.getMovieGenres({ language: request.locale })
          : await tmdb.getTvGenres({ language: request.locale });
      const tags: MetadataTagCatalogEntry[] = tmdbGenres.map((genre) => ({
        provider: MetadataTagProvider.TMDB,
        type: MetadataTagType.GENRE,
        id: genre.id,
        name: genre.name,
      }));
      const unavailableProviders: MetadataTagProvider[] = [];

      if (mediaType === MediaType.TV) {
        try {
          const tvdb = await Tvdb.getInstance();
          const tvdbGenres = await tvdb.getGenres();
          tags.push(
            ...tvdbGenres.map((genre) => ({
              provider: MetadataTagProvider.TVDB,
              type: MetadataTagType.GENRE,
              id: genre.id,
              name: genre.name,
            }))
          );
        } catch (error) {
          unavailableProviders.push(MetadataTagProvider.TVDB);
          logger.warn('Unable to retrieve TVDB genres', {
            label: 'Backend Selection',
            errorMessage: error.message,
          });
        }
      }

      tags.sort(
        (firstTag, secondTag) =>
          firstTag.provider.localeCompare(secondTag.provider) ||
          firstTag.name.localeCompare(secondTag.name)
      );

      return response.status(200).json({ tags, unavailableProviders });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({ status: 500, message: 'Unable to retrieve genre tags.' });
    }
  }
);

backendSelectionRoutes.post(
  '/recommendation',
  async (request, response, next) => {
    try {
      const values = recommendationSchema.parse(request.body);
      const rules = await getRepository(BackendSelectionRule).find({
        where: { mediaType: values.mediaType },
        order: { position: 'ASC', id: 'ASC' },
      });
      const settings = getSettings();
      const backends =
        values.mediaType === MediaType.MOVIE
          ? settings.radarr
          : settings.sonarr;
      const recommendation: BackendSelectionRecommendationResponse =
        selectBackendForMetadata({
          mediaType: values.mediaType,
          is4k: values.is4k,
          metadataTags: values.tags,
          rules,
          backends,
        });

      return response.status(200).json(recommendation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({
        status: 500,
        message: 'Unable to determine the backend selection.',
      });
    }
  }
);

backendSelectionRoutes.post(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const values = ruleValuesSchema.parse(request.body);
      if (!serviceExists(values.mediaType, values.serviceId)) {
        return next({
          status: 400,
          message: 'The selected service is invalid.',
        });
      }

      const ruleRepository = getRepository(BackendSelectionRule);
      const lastRule = await ruleRepository.findOne({
        where: { mediaType: values.mediaType },
        order: { position: 'DESC', id: 'DESC' },
      });
      const rule = await ruleRepository.save(
        new BackendSelectionRule({
          ...values,
          tags: deduplicateTags(values.tags),
          position: (lastRule?.position ?? -1) + 1,
        })
      );

      return response.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({ status: 500, message: 'Unable to create the rule.' });
    }
  }
);

backendSelectionRoutes.put(
  '/order/:mediaType',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const mediaType = mediaTypeSchema.parse(request.params.mediaType);
      const { ruleIds } = reorderSchema.parse(request.body);
      const uniqueRuleIds = new Set<number>(ruleIds);
      const existingRules = await getRepository(BackendSelectionRule).find({
        where: { mediaType },
      });
      const existingRuleIds = new Set<number>(
        existingRules.map((rule) => rule.id)
      );
      const containsEveryRule =
        uniqueRuleIds.size === existingRuleIds.size &&
        [...uniqueRuleIds].every((ruleId) => existingRuleIds.has(ruleId));

      if (!containsEveryRule || uniqueRuleIds.size !== ruleIds.length) {
        return next({
          status: 400,
          message: 'The complete ordered rule list is required.',
        });
      }

      await dataSource.transaction(async (entityManager) => {
        const ruleRepository =
          entityManager.getRepository(BackendSelectionRule);
        for (const [position, ruleId] of ruleIds.entries()) {
          await ruleRepository.update({ id: ruleId, mediaType }, { position });
        }
      });

      const reorderedRules = await getRepository(BackendSelectionRule).find({
        where: { id: In(ruleIds), mediaType },
        order: { position: 'ASC', id: 'ASC' },
      });
      return response.status(200).json(reorderedRules);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({ status: 500, message: 'Unable to reorder the rules.' });
    }
  }
);

backendSelectionRoutes.put(
  '/:ruleId',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const ruleId = ruleIdSchema.parse(request.params.ruleId);
      const values = ruleValuesSchema.parse(request.body);
      const ruleRepository = getRepository(BackendSelectionRule);
      const rule = await ruleRepository.findOne({ where: { id: ruleId } });

      if (!rule) {
        return next({ status: 404, message: 'Rule not found.' });
      }
      if (!serviceExists(values.mediaType, values.serviceId)) {
        return next({
          status: 400,
          message: 'The selected service is invalid.',
        });
      }

      const mediaTypeChanged = rule.mediaType !== values.mediaType;
      const lastRule = mediaTypeChanged
        ? await ruleRepository.findOne({
            where: { mediaType: values.mediaType },
            order: { position: 'DESC', id: 'DESC' },
          })
        : null;
      Object.assign(rule, values, {
        tags: deduplicateTags(values.tags),
        position: mediaTypeChanged
          ? (lastRule?.position ?? -1) + 1
          : rule.position,
      });
      const savedRule = await ruleRepository.save(rule);
      return response.status(200).json(savedRule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({ status: 500, message: 'Unable to update the rule.' });
    }
  }
);

backendSelectionRoutes.delete(
  '/:ruleId',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const ruleId = ruleIdSchema.parse(request.params.ruleId);
      const ruleRepository = getRepository(BackendSelectionRule);
      const rule = await ruleRepository.findOne({ where: { id: ruleId } });

      if (!rule) {
        return next({ status: 404, message: 'Rule not found.' });
      }

      await ruleRepository.remove(rule);
      return response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }
      return next({ status: 500, message: 'Unable to delete the rule.' });
    }
  }
);

export default backendSelectionRoutes;
