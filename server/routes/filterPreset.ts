import dataSource, { getRepository } from '@server/datasource';
import FilterPreset from '@server/entity/FilterPreset';
import type { FilterPresetResultsResponse } from '@server/interfaces/api/filterPresetInterfaces';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';

const nonnegativeIntegerString = z.string().refine((value) => {
  const numericValue = Number(value);
  return (
    value.trim().length > 0 &&
    Number.isInteger(numericValue) &&
    numericValue >= 0
  );
});

const userScoreString = z.string().refine((value) => {
  const numericValue = Number(value);
  return (
    value.trim().length > 0 &&
    Number.isFinite(numericValue) &&
    numericValue >= 0 &&
    numericValue <= 10
  );
});

const filterValuesSchema = z
  .strictObject({
    sortBy: z.string().optional(),
    primaryReleaseDateGte: z.string().optional(),
    primaryReleaseDateLte: z.string().optional(),
    firstAirDateGte: z.string().optional(),
    firstAirDateLte: z.string().optional(),
    studio: z.string().optional(),
    genre: z.string().optional(),
    keywords: z.string().optional(),
    excludeKeywords: z.string().optional(),
    language: z.string().optional(),
    withRuntimeGte: nonnegativeIntegerString.optional(),
    withRuntimeLte: nonnegativeIntegerString.optional(),
    voteAverageGte: userScoreString.optional(),
    voteAverageLte: userScoreString.optional(),
    voteCountGte: nonnegativeIntegerString.optional(),
    voteCountLte: nonnegativeIntegerString.optional(),
    watchRegion: z.string().optional(),
    watchProviders: z.string().optional(),
    status: z.string().optional(),
    certification: z.string().optional(),
    certificationGte: z.string().optional(),
    certificationLte: z.string().optional(),
    certificationCountry: z.string().optional(),
    certificationMode: z.enum(['exact', 'range']).optional(),
  })
  .refine(
    (filterValues) =>
      Object.entries(filterValues).some(
        ([filterName, filterValue]) =>
          filterName !== 'certificationMode' &&
          filterValue !== undefined &&
          filterValue.length > 0
      ),
    { message: 'At least one filter value is required.' }
  );

const createFilterPresetSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  filters: filterValuesSchema,
});

const defaultFilterPresetSchema = z.strictObject({
  presetId: z.number().int().positive().nullable(),
});

const mediaTypeSchema = z.enum(['movie', 'tv']);
const presetIdSchema = z.coerce.number().int().positive();

const hasApplicableFilters = (
  preset: FilterPreset,
  mediaType: 'movie' | 'tv'
): boolean => {
  return Object.entries(preset.filters).some(([filterName, filterValue]) => {
    if (filterName === 'certificationMode' || filterValue.length === 0) {
      return false;
    }

    switch (mediaType) {
      case 'movie':
        return filterName !== 'status';
      case 'tv':
        return filterName !== 'studio';
    }
  });
};

const filterPresetRoutes = Router();

filterPresetRoutes.get('/', async (_request, response, next) => {
  try {
    const filterPresetRepository = getRepository(FilterPreset);
    const presets = await filterPresetRepository
      .createQueryBuilder('filterPreset')
      .orderBy('LOWER(filterPreset.name)', 'ASC')
      .getMany();

    return response.status(200).json(presets as FilterPresetResultsResponse);
  } catch (error) {
    logger.error('Unable to retrieve filter presets', {
      label: 'Filter Presets',
      errorMessage: error.message,
    });
    return next({ status: 500, message: 'Unable to retrieve filter presets.' });
  }
});

filterPresetRoutes.post(
  '/',
  isAuthenticated(Permission.MANAGE_FILTER_PRESETS),
  async (request, response, next) => {
    try {
      const values = createFilterPresetSchema.parse(request.body);
      const filterPresetRepository = getRepository(FilterPreset);
      const existingPreset = await filterPresetRepository
        .createQueryBuilder('filterPreset')
        .where('LOWER(filterPreset.name) = LOWER(:name)', {
          name: values.name,
        })
        .getOne();

      if (existingPreset) {
        return next({
          status: 409,
          message: 'A filter preset with this name already exists.',
        });
      }

      const preset = await filterPresetRepository.save(
        new FilterPreset({
          name: values.name,
          filters: values.filters,
        })
      );

      return response.status(201).json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }

      if (
        error instanceof QueryFailedError &&
        (error.driverError.code === '23505' || error.driverError.errno === 19)
      ) {
        return next({
          status: 409,
          message: 'A filter preset with this name already exists.',
        });
      }

      logger.error('Unable to save filter preset', {
        label: 'Filter Presets',
        errorMessage: error.message,
      });
      return next({ status: 500, message: 'Unable to save filter preset.' });
    }
  }
);

filterPresetRoutes.put(
  '/default/:mediaType',
  isAuthenticated(Permission.ADMIN),
  async (request, response, next) => {
    try {
      const mediaType = mediaTypeSchema.parse(request.params.mediaType);
      const { presetId } = defaultFilterPresetSchema.parse(request.body);

      const updatedPreset = await dataSource.transaction(
        async (entityManager): Promise<FilterPreset | null> => {
          const filterPresetRepository =
            entityManager.getRepository(FilterPreset);
          let preset: FilterPreset | null = null;

          if (presetId !== null) {
            preset = await filterPresetRepository.findOne({
              where: { id: presetId },
            });

            if (!preset) {
              throw new Error('FILTER_PRESET_NOT_FOUND');
            }

            if (!hasApplicableFilters(preset, mediaType)) {
              throw new Error('FILTER_PRESET_NOT_APPLICABLE');
            }
          }

          switch (mediaType) {
            case 'movie':
              await filterPresetRepository.update(
                { isDefaultMovie: true },
                { isDefaultMovie: false }
              );
              if (preset) {
                preset.isDefaultMovie = true;
                return filterPresetRepository.save(preset);
              }
              break;
            case 'tv':
              await filterPresetRepository.update(
                { isDefaultTv: true },
                { isDefaultTv: false }
              );
              if (preset) {
                preset.isDefaultTv = true;
                return filterPresetRepository.save(preset);
              }
              break;
          }

          return null;
        }
      );

      return response.status(200).json(updatedPreset);
    } catch (error) {
      if (error.message === 'FILTER_PRESET_NOT_FOUND') {
        return next({ status: 404, message: 'Filter preset not found.' });
      }

      if (error.message === 'FILTER_PRESET_NOT_APPLICABLE') {
        return next({
          status: 400,
          message: 'Filter preset has no filters for this media type.',
        });
      }

      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }

      logger.error('Unable to update default filter preset', {
        label: 'Filter Presets',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to update default filter preset.',
      });
    }
  }
);

filterPresetRoutes.delete(
  '/:presetId',
  isAuthenticated(Permission.MANAGE_FILTER_PRESETS),
  async (request, response, next) => {
    try {
      const filterPresetRepository = getRepository(FilterPreset);
      const presetId = presetIdSchema.parse(request.params.presetId);
      const preset = await filterPresetRepository.findOne({
        where: { id: presetId },
      });

      if (!preset) {
        return next({ status: 404, message: 'Filter preset not found.' });
      }

      await filterPresetRepository.remove(preset);
      return response.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: error.message });
      }

      return next({ status: 500, message: error.message });
    }
  }
);

export default filterPresetRoutes;
