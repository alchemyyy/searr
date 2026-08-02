import Button from '@app/components/Common/Button';
import MultiRangeSlider from '@app/components/Common/MultiRangeSlider';
import SlideOver from '@app/components/Common/SlideOver';
import type { FilterOptions } from '@app/components/Discover/constants';
import {
  countActiveFilters,
  createPresetQueryUpdate,
} from '@app/components/Discover/constants';
import FilterPresetControls from '@app/components/Discover/FilterPresetControls';
import NumericRangeInput from '@app/components/Discover/NumericRangeInput';
import LanguageSelector from '@app/components/LanguageSelector';
import {
  CompanySelector,
  GenreSelector,
  KeywordSelector,
  StatusSelector,
  USCertificationSelector,
  WatchProviderSelector,
} from '@app/components/Selector';
import useSettings from '@app/hooks/useSettings';
import {
  useBatchUpdateQueryParams,
  useUpdateQueryParams,
} from '@app/hooks/useUpdateQueryParams';
import defineMessages from '@app/utils/defineMessages';
import { XCircleIcon } from '@heroicons/react/24/outline';
import Datepicker from '@seerr-team/react-tailwindcss-datepicker';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const RUNTIME_MINIMUM = 0;
const RUNTIME_DEFAULT_MAXIMUM = 400;
const RUNTIME_STEP = 1;
const USER_SCORE_MINIMUM = 1;
const USER_SCORE_MAXIMUM = 10;
const USER_SCORE_STEP = 0.1;
const VOTE_COUNT_MINIMUM = 0;
const VOTE_COUNT_DEFAULT_MAXIMUM = 1000;
const VOTE_COUNT_STEP = 1;

/** Parses a finite numeric query filter. */
const parseNumericFilter = (value?: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

/** Expands a slider for typed values without shrinking after thumb updates. */
const useExpandableSliderMaximum = (
  defaultMaximum: number,
  minimumValue?: string,
  maximumValue?: string
): number => {
  const parsedMinimum = parseNumericFilter(minimumValue);
  const parsedMaximum = parseNumericFilter(maximumValue);
  const requiredMaximum = Math.max(
    defaultMaximum,
    parsedMinimum ?? defaultMaximum,
    parsedMaximum ?? defaultMaximum
  );
  const [sliderMaximum, setSliderMaximum] = useState(requiredMaximum);

  useEffect(() => {
    const filtersCleared =
      minimumValue === undefined && maximumValue === undefined;
    setSliderMaximum((currentMaximum) =>
      filtersCleared
        ? defaultMaximum
        : Math.max(currentMaximum, requiredMaximum)
    );
  }, [defaultMaximum, maximumValue, minimumValue, requiredMaximum]);

  return Math.max(sliderMaximum, requiredMaximum);
};

const messages = defineMessages('components.Discover.FilterSlideover', {
  filters: 'Filters',
  activefilters:
    '{count, plural, one {# Active Filter} other {# Active Filters}}',
  releaseDate: 'Release Date',
  firstAirDate: 'First Air Date',
  from: 'From',
  to: 'To',
  studio: 'Studio',
  genres: 'Genres',
  keywords: 'Keywords',
  excludeKeywords: 'Exclude Keywords',
  originalLanguage: 'Original Language',
  runtimeText: '{minValue}-{maxValue} minute runtime',
  ratingText: 'Ratings between {minValue} and {maxValue}',
  clearfilters: 'Clear Active Filters',
  tmdbuserscore: 'TMDB User Score',
  tmdbuservotecount: 'TMDB User Vote Count',
  runtime: 'Runtime',
  streamingservices: 'Streaming Services',
  voteCount: 'Number of votes between {minValue} and {maxValue}',
  status: 'Status',
  certification: 'Content Rating',
  maximumRuntime: 'Maximum Runtime (Minutes)',
  minimumRuntime: 'Minimum Runtime (Minutes)',
  maximumUserScore: 'Maximum User Score',
  minimumUserScore: 'Minimum User Score',
  maximumVoteCount: 'Maximum User Vote Count',
  minimumVoteCount: 'Minimum User Vote Count',
  noMinimum: 'No minimum',
  noMaximum: 'No maximum',
});

type FilterSlideoverProps = {
  show: boolean;
  onClose: () => void;
  type: 'movie' | 'tv';
  currentFilters: FilterOptions;
};

const FilterSlideover = ({
  show,
  onClose,
  type,
  currentFilters,
}: FilterSlideoverProps) => {
  const intl = useIntl();
  const { currentSettings } = useSettings();
  const updateQueryParams = useUpdateQueryParams({});
  const batchUpdateQueryParams = useBatchUpdateQueryParams({});

  const dateGte =
    type === 'movie' ? 'primaryReleaseDateGte' : 'firstAirDateGte';
  const dateLte =
    type === 'movie' ? 'primaryReleaseDateLte' : 'firstAirDateLte';
  const runtimeMinimumValue = parseNumericFilter(currentFilters.withRuntimeGte);
  const runtimeMaximumValue = parseNumericFilter(currentFilters.withRuntimeLte);
  const userScoreMinimumValue = parseNumericFilter(
    currentFilters.voteAverageGte
  );
  const userScoreMaximumValue = parseNumericFilter(
    currentFilters.voteAverageLte
  );
  const voteCountMinimumValue = parseNumericFilter(currentFilters.voteCountGte);
  const voteCountMaximumValue = parseNumericFilter(currentFilters.voteCountLte);
  const runtimeSliderMaximum = useExpandableSliderMaximum(
    RUNTIME_DEFAULT_MAXIMUM,
    currentFilters.withRuntimeGte,
    currentFilters.withRuntimeLte
  );
  const voteCountSliderMaximum = useExpandableSliderMaximum(
    VOTE_COUNT_DEFAULT_MAXIMUM,
    currentFilters.voteCountGte,
    currentFilters.voteCountLte
  );

  return (
    <SlideOver
      show={show}
      title={intl.formatMessage(messages.filters)}
      subText={intl.formatMessage(messages.activefilters, {
        count: countActiveFilters(currentFilters),
      })}
      onClose={() => onClose()}
    >
      <div className="flex flex-col space-y-4">
        <FilterPresetControls
          type={type}
          currentFilters={currentFilters}
          onApply={(filterValues) => {
            batchUpdateQueryParams(createPresetQueryUpdate(filterValues, type));
          }}
        />
        <div>
          <div className="mb-2 text-lg font-semibold">
            {intl.formatMessage(
              type === 'movie' ? messages.releaseDate : messages.firstAirDate
            )}
          </div>
          <div className="relative z-40 flex space-x-2">
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.from)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters[dateGte] ?? null,
                  endDate: currentFilters[dateGte] ?? null,
                }}
                onChange={(value) => {
                  updateQueryParams(
                    dateGte,
                    value?.startDate ? (value.startDate as string) : undefined
                  );
                }}
                inputName="fromdate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
              />
            </div>
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.to)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters[dateLte] ?? null,
                  endDate: currentFilters[dateLte] ?? null,
                }}
                onChange={(value) => {
                  updateQueryParams(
                    dateLte,
                    value?.startDate ? (value.startDate as string) : undefined
                  );
                }}
                inputName="todate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
              />
            </div>
          </div>
        </div>
        {type === 'movie' && (
          <>
            <span className="text-lg font-semibold">
              {intl.formatMessage(messages.studio)}
            </span>
            <CompanySelector
              defaultValue={currentFilters.studio}
              onChange={(value) => {
                updateQueryParams('studio', value?.value.toString());
              }}
            />
          </>
        )}
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.genres)}
        </span>
        <GenreSelector
          type={type}
          defaultValue={currentFilters.genre}
          isMulti
          onChange={(value) => {
            updateQueryParams('genre', value?.map((v) => v.value).join(','));
          }}
        />
        {type === 'tv' && (
          <>
            <span className="text-lg font-semibold">
              {intl.formatMessage(messages.status)}
            </span>
            <StatusSelector
              defaultValue={currentFilters.status}
              isMulti
              onChange={(value) => {
                updateQueryParams(
                  'status',
                  value?.map((v) => v.value).join('|')
                );
              }}
            />
          </>
        )}
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.keywords)}
        </span>
        <KeywordSelector
          defaultValue={currentFilters.keywords}
          isMulti
          onChange={(value) => {
            updateQueryParams('keywords', value?.map((v) => v.value).join(','));
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.excludeKeywords)}
        </span>
        <KeywordSelector
          defaultValue={currentFilters.excludeKeywords}
          isMulti
          onChange={(value) => {
            updateQueryParams(
              'excludeKeywords',
              value?.map((v) => v.value).join(',')
            );
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.originalLanguage)}
        </span>
        <LanguageSelector
          value={currentFilters.language}
          serverValue={currentSettings.originalLanguage}
          isUserSettings
          setFieldValue={(_key, value) => {
            updateQueryParams('language', value);
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.certification)}
        </span>
        <USCertificationSelector
          type={type}
          certification={currentFilters.certification}
          onChange={(params) => {
            batchUpdateQueryParams(params);
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.runtime)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={RUNTIME_MINIMUM}
            max={runtimeSliderMaximum}
            step={RUNTIME_STEP}
            onUpdateMin={(minimumValue) => {
              updateQueryParams(
                'withRuntimeGte',
                minimumValue !== RUNTIME_MINIMUM
                  ? minimumValue.toString()
                  : undefined
              );
            }}
            onUpdateMax={(maximumValue) => {
              updateQueryParams(
                'withRuntimeLte',
                maximumValue !== runtimeSliderMaximum
                  ? maximumValue.toString()
                  : undefined
              );
            }}
            defaultMaxValue={runtimeMaximumValue}
            defaultMinValue={runtimeMinimumValue}
            subText={intl.formatMessage(messages.runtimeText, {
              minValue: currentFilters.withRuntimeGte ?? RUNTIME_MINIMUM,
              maxValue: currentFilters.withRuntimeLte ?? runtimeSliderMaximum,
            })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumericRangeInput
              id="minimumRuntime"
              label={intl.formatMessage(messages.minimumRuntime)}
              value={currentFilters.withRuntimeGte}
              minimum={RUNTIME_MINIMUM}
              maximum={runtimeMaximumValue}
              step={RUNTIME_STEP}
              placeholder={intl.formatMessage(messages.noMinimum)}
              onUpdate={(value) => updateQueryParams('withRuntimeGte', value)}
            />
            <NumericRangeInput
              id="maximumRuntime"
              label={intl.formatMessage(messages.maximumRuntime)}
              value={currentFilters.withRuntimeLte}
              minimum={runtimeMinimumValue ?? RUNTIME_MINIMUM}
              step={RUNTIME_STEP}
              placeholder={intl.formatMessage(messages.noMaximum)}
              onUpdate={(value) => updateQueryParams('withRuntimeLte', value)}
            />
          </div>
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.tmdbuserscore)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={USER_SCORE_MINIMUM}
            max={USER_SCORE_MAXIMUM}
            step={USER_SCORE_STEP}
            defaultMaxValue={userScoreMaximumValue}
            defaultMinValue={userScoreMinimumValue}
            onUpdateMin={(minimumValue) => {
              updateQueryParams(
                'voteAverageGte',
                minimumValue !== USER_SCORE_MINIMUM
                  ? minimumValue.toString()
                  : undefined
              );
            }}
            onUpdateMax={(maximumValue) => {
              updateQueryParams(
                'voteAverageLte',
                maximumValue !== USER_SCORE_MAXIMUM
                  ? maximumValue.toString()
                  : undefined
              );
            }}
            subText={intl.formatMessage(messages.ratingText, {
              minValue: currentFilters.voteAverageGte ?? USER_SCORE_MINIMUM,
              maxValue: currentFilters.voteAverageLte ?? USER_SCORE_MAXIMUM,
            })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumericRangeInput
              id="minimumUserScore"
              label={intl.formatMessage(messages.minimumUserScore)}
              value={currentFilters.voteAverageGte}
              minimum={USER_SCORE_MINIMUM}
              maximum={userScoreMaximumValue ?? USER_SCORE_MAXIMUM}
              step={USER_SCORE_STEP}
              placeholder={intl.formatMessage(messages.noMinimum)}
              onUpdate={(value) => updateQueryParams('voteAverageGte', value)}
            />
            <NumericRangeInput
              id="maximumUserScore"
              label={intl.formatMessage(messages.maximumUserScore)}
              value={currentFilters.voteAverageLte}
              minimum={userScoreMinimumValue ?? USER_SCORE_MINIMUM}
              maximum={USER_SCORE_MAXIMUM}
              step={USER_SCORE_STEP}
              placeholder={intl.formatMessage(messages.noMaximum)}
              onUpdate={(value) => updateQueryParams('voteAverageLte', value)}
            />
          </div>
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.tmdbuservotecount)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={VOTE_COUNT_MINIMUM}
            max={voteCountSliderMaximum}
            step={VOTE_COUNT_STEP}
            defaultMaxValue={voteCountMaximumValue}
            defaultMinValue={voteCountMinimumValue}
            onUpdateMin={(minimumValue) => {
              updateQueryParams(
                'voteCountGte',
                minimumValue !== VOTE_COUNT_MINIMUM
                  ? minimumValue.toString()
                  : undefined
              );
            }}
            onUpdateMax={(maximumValue) => {
              updateQueryParams(
                'voteCountLte',
                maximumValue !== voteCountSliderMaximum
                  ? maximumValue.toString()
                  : undefined
              );
            }}
            subText={intl.formatMessage(messages.voteCount, {
              minValue: currentFilters.voteCountGte ?? VOTE_COUNT_MINIMUM,
              maxValue: currentFilters.voteCountLte ?? voteCountSliderMaximum,
            })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumericRangeInput
              id="minimumVoteCount"
              label={intl.formatMessage(messages.minimumVoteCount)}
              value={currentFilters.voteCountGte}
              minimum={VOTE_COUNT_MINIMUM}
              maximum={voteCountMaximumValue}
              step={VOTE_COUNT_STEP}
              placeholder={intl.formatMessage(messages.noMinimum)}
              onUpdate={(value) => updateQueryParams('voteCountGte', value)}
            />
            <NumericRangeInput
              id="maximumVoteCount"
              label={intl.formatMessage(messages.maximumVoteCount)}
              value={currentFilters.voteCountLte}
              minimum={voteCountMinimumValue ?? VOTE_COUNT_MINIMUM}
              step={VOTE_COUNT_STEP}
              placeholder={intl.formatMessage(messages.noMaximum)}
              onUpdate={(value) => updateQueryParams('voteCountLte', value)}
            />
          </div>
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.streamingservices)}
        </span>
        <WatchProviderSelector
          type={type}
          region={currentFilters.watchRegion}
          activeProviders={
            currentFilters.watchProviders?.split('|').map((v) => Number(v)) ??
            []
          }
          onChange={(region, providers) => {
            if (providers.length) {
              batchUpdateQueryParams({
                watchRegion: region,
                watchProviders: providers.join('|'),
              });
            } else {
              batchUpdateQueryParams({
                watchRegion: undefined,
                watchProviders: undefined,
              });
            }
          }}
        />
        <div className="pt-4">
          <Button
            className="w-full"
            disabled={Object.keys(currentFilters).length === 0}
            onClick={() => {
              const copyCurrent = Object.assign({}, currentFilters);
              (
                Object.keys(copyCurrent) as (keyof typeof currentFilters)[]
              ).forEach((k) => {
                copyCurrent[k] = undefined;
              });
              batchUpdateQueryParams(copyCurrent);
              onClose();
            }}
          >
            <XCircleIcon />
            <span>{intl.formatMessage(messages.clearfilters)}</span>
          </Button>
        </div>
      </div>
    </SlideOver>
  );
};

export default FilterSlideover;
