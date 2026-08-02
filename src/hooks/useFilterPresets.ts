import type { FilterOptions } from '@app/components/Discover/constants';
import { createPresetQueryUpdate } from '@app/components/Discover/constants';
import { useBatchUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import useSWR, { type SWRResponse } from 'swr';

export interface FilterPreset {
  id: number;
  name: string;
  filters: FilterOptions;
  isDefaultMovie: boolean;
  isDefaultTv: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useFilterPresets = (): SWRResponse<FilterPreset[]> =>
  useSWR<FilterPreset[]>('/api/v1/filter-presets');

/** Applies a section's global default once when opening an unfiltered page. */
export const useDefaultFilterPreset = (
  type: 'movie' | 'tv',
  currentFilters: FilterOptions
): void => {
  const router = useRouter();
  const batchUpdateQueryParams = useBatchUpdateQueryParams({});
  const { data: filterPresets } = useFilterPresets();
  const defaultWasHandled = useRef(false);

  useEffect(() => {
    if (
      defaultWasHandled.current ||
      !router.isReady ||
      filterPresets === undefined
    ) {
      return;
    }

    defaultWasHandled.current = true;

    if (Object.keys(currentFilters).length > 0) {
      return;
    }

    const defaultPreset = filterPresets.find((filterPreset) =>
      type === 'movie' ? filterPreset.isDefaultMovie : filterPreset.isDefaultTv
    );

    if (!defaultPreset) {
      return;
    }

    batchUpdateQueryParams(
      createPresetQueryUpdate(defaultPreset.filters, type)
    );
  }, [
    batchUpdateQueryParams,
    currentFilters,
    filterPresets,
    router.isReady,
    type,
  ]);
};

export default useFilterPresets;
