import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import type { FilterOptions } from '@app/components/Discover/constants';
import {
  filterValuesMatch,
  preparePresetFilterValues,
} from '@app/components/Discover/constants';
import useFilterPresets from '@app/hooks/useFilterPresets';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { BookmarkIcon, StarIcon, TrashIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.FilterPresetControls', {
  filterPresets: 'Filter Presets',
  globalDescription:
    'Presets are shared globally and can be loaded by every user.',
  selectPreset: 'Select a preset',
  noPresets: 'No presets have been saved',
  movieDefault: 'Movie default',
  seriesDefault: 'Series default',
  presetName: 'Preset name',
  savePreset: 'Save Preset',
  savingPreset: 'Saving…',
  deletePreset: 'Delete Preset',
  deletingPreset: 'Deleting…',
  confirmDelete: 'Click again to delete',
  setDefault: 'Set as {section} Default',
  clearDefault: 'Clear {section} Default',
  movie: 'Movie',
  series: 'Series',
  saved: 'Filter preset saved.',
  saveFailed: 'Unable to save filter preset.',
  deleted: 'Filter preset deleted.',
  deleteFailed: 'Unable to delete filter preset.',
  defaultUpdated: 'Default filter preset updated.',
  defaultUpdateFailed: 'Unable to update the default filter preset.',
});

interface FilterPresetControlsProps {
  type: 'movie' | 'tv';
  currentFilters: FilterOptions;
  onApply: (filterValues: FilterOptions) => void;
}

const FilterPresetControls = ({
  type,
  currentFilters,
  onApply,
}: FilterPresetControlsProps): React.JSX.Element => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { hasPermission } = useUser();
  const { data: filterPresets = [], mutate } = useFilterPresets();
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<number>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const pendingPresetId = useRef<number | undefined>(undefined);

  const normalizedCurrentFilters = preparePresetFilterValues(
    currentFilters,
    type
  );
  const matchingPreset = filterPresets.find((filterPreset) =>
    filterValuesMatch(
      normalizedCurrentFilters,
      preparePresetFilterValues(filterPreset.filters, type)
    )
  );
  const selectedPreset = filterPresets.find(
    (filterPreset) => filterPreset.id === selectedPresetId
  );
  const selectedPresetMatches = selectedPreset
    ? filterValuesMatch(
        normalizedCurrentFilters,
        preparePresetFilterValues(selectedPreset.filters, type)
      )
    : false;
  const selectedPresetHasApplicableFilters = selectedPreset
    ? Object.keys(preparePresetFilterValues(selectedPreset.filters, type))
        .length > 0
    : false;

  useEffect(() => {
    if (selectedPresetId !== undefined && selectedPresetMatches) {
      pendingPresetId.current = undefined;
      return;
    }

    if (
      selectedPresetId !== undefined &&
      pendingPresetId.current === selectedPresetId
    ) {
      return;
    }

    setSelectedPresetId(matchingPreset?.id);
  }, [matchingPreset?.id, selectedPresetId, selectedPresetMatches]);
  const canManagePresets = hasPermission(Permission.MANAGE_FILTER_PRESETS);
  const isSelectedDefault = selectedPreset
    ? type === 'movie'
      ? selectedPreset.isDefaultMovie
      : selectedPreset.isDefaultTv
    : false;
  const sectionName = intl.formatMessage(
    type === 'movie' ? messages.movie : messages.series
  );

  const savePreset = async (): Promise<void> => {
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post<{ id: number }>(
        '/api/v1/filter-presets',
        {
          name: normalizedName,
          filters: normalizedCurrentFilters,
        }
      );
      await mutate();
      setSelectedPresetId(response.data.id);
      setPresetName('');
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.saveFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePreset = async (): Promise<void> => {
    if (!selectedPreset) {
      return;
    }

    setIsDeleting(true);
    try {
      await axios.delete(`/api/v1/filter-presets/${selectedPreset.id}`);
      await mutate();
      setSelectedPresetId(undefined);
      addToast(intl.formatMessage(messages.deleted), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.deleteFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const updateDefault = async (): Promise<void> => {
    if (!selectedPreset) {
      return;
    }

    setIsUpdatingDefault(true);
    try {
      await axios.put(`/api/v1/filter-presets/default/${type}`, {
        presetId: isSelectedDefault ? null : selectedPreset.id,
      });
      await mutate();
      addToast(intl.formatMessage(messages.defaultUpdated), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.defaultUpdateFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdatingDefault(false);
    }
  };

  return (
    <div className="space-y-3 border-b border-gray-700 pb-5">
      <div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.filterPresets)}
        </span>
        <p className="mt-1 text-sm text-gray-400">
          {intl.formatMessage(messages.globalDescription)}
        </p>
      </div>
      <select
        aria-label={intl.formatMessage(messages.selectPreset)}
        value={selectedPresetId ?? ''}
        disabled={filterPresets.length === 0}
        onChange={(event) => {
          if (!event.target.value) {
            setSelectedPresetId(undefined);
            return;
          }

          const presetId = Number(event.target.value);
          const filterPreset = filterPresets.find(
            (preset) => preset.id === presetId
          );
          if (filterPreset) {
            pendingPresetId.current = filterPreset.id;
            setSelectedPresetId(filterPreset.id);
            onApply(filterPreset.filters);
          }
        }}
      >
        <option value="" disabled>
          {intl.formatMessage(
            filterPresets.length > 0
              ? messages.selectPreset
              : messages.noPresets
          )}
        </option>
        {filterPresets.map((filterPreset) => {
          const defaultSections: string[] = [];
          if (filterPreset.isDefaultMovie) {
            defaultSections.push(intl.formatMessage(messages.movieDefault));
          }
          if (filterPreset.isDefaultTv) {
            defaultSections.push(intl.formatMessage(messages.seriesDefault));
          }
          const defaultLabel =
            defaultSections.length > 0
              ? ` (${defaultSections.join(', ')})`
              : '';

          return (
            <option key={filterPreset.id} value={filterPreset.id}>
              {filterPreset.name}
              {defaultLabel}
            </option>
          );
        })}
      </select>
      {canManagePresets && (
        <div className="flex gap-2">
          <input
            type="text"
            value={presetName}
            maxLength={100}
            placeholder={intl.formatMessage(messages.presetName)}
            aria-label={intl.formatMessage(messages.presetName)}
            onChange={(event) => setPresetName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void savePreset();
              }
            }}
          />
          <Button
            buttonType="primary"
            disabled={
              isSaving ||
              presetName.trim().length === 0 ||
              Object.keys(normalizedCurrentFilters).length === 0
            }
            onClick={() => void savePreset()}
          >
            <BookmarkIcon />
            <span>
              {intl.formatMessage(
                isSaving ? messages.savingPreset : messages.savePreset
              )}
            </span>
          </Button>
        </div>
      )}
      {selectedPreset && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasPermission(Permission.ADMIN) && (
            <Button
              className="flex-1"
              buttonType={isSelectedDefault ? 'warning' : 'default'}
              disabled={
                isUpdatingDefault ||
                (!isSelectedDefault && !selectedPresetHasApplicableFilters)
              }
              onClick={() => void updateDefault()}
            >
              <StarIcon />
              <span>
                {intl.formatMessage(
                  isSelectedDefault
                    ? messages.clearDefault
                    : messages.setDefault,
                  { section: sectionName }
                )}
              </span>
            </Button>
          )}
          {canManagePresets && (
            <ConfirmButton
              className={`flex-1 ${
                isDeleting ? 'pointer-events-none opacity-50' : ''
              }`}
              onClick={() => void deletePreset()}
              confirmText={intl.formatMessage(messages.confirmDelete)}
            >
              <TrashIcon />
              <span>
                {intl.formatMessage(
                  isDeleting ? messages.deletingPreset : messages.deletePreset
                )}
              </span>
            </ConfirmButton>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPresetControls;
