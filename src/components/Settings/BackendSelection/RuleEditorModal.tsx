import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagProvider,
  type MetadataTagReference,
} from '@server/constants/backendSelection';
import type { MediaType } from '@server/constants/media';
import type BackendSelectionRule from '@server/entity/BackendSelectionRule';
import type { MetadataTagCatalogResponse } from '@server/interfaces/api/backendSelectionInterfaces';
import type { DVRSettings } from '@server/lib/settings';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.Settings.BackendSelection.RuleEditor',
  {
    addRule: 'Add Backend Default',
    editRule: 'Edit Backend Default',
    ruleType: 'Rule Type',
    allow: 'ALLOW',
    block: 'BLOCK',
    allowDescription:
      'ALLOW preselects this backend when the genre collection matches.',
    blockDescription:
      'BLOCK prevents this backend from being automatically preselected. Users can still select it manually.',
    matchType: 'Genre Match',
    any: 'ANY',
    all: 'ALL',
    anyDescription: 'Match when any selected genre is present.',
    allDescription: 'Match only when every selected genre is present.',
    backend: 'Destination Backend',
    selectedGenres: 'Selected Genres',
    noSelectedGenres: 'Click genres below to add them to this rule.',
    availableGenres: 'Available Genres',
    genreCatalogUnavailable: '{provider} genres are currently unavailable.',
    missingBackend: 'Missing backend (#{id})',
    saveFailed: 'Unable to save the backend default.',
    createSuccess: 'Backend default created.',
    updateSuccess: 'Backend default updated.',
  }
);

type BackendSummary = Pick<DVRSettings, 'id' | 'name' | 'is4k'>;

interface RuleEditorModalProps {
  mediaType: MediaType;
  rule: BackendSelectionRule | null;
  backends: BackendSummary[];
  onClose: () => void;
  onSave: () => void;
}

const getTagKey = (tag: MetadataTagReference): string =>
  `${tag.provider}:${tag.type}:${tag.id}`;

const toTagReference = (tag: MetadataTagReference): MetadataTagReference => ({
  provider: tag.provider,
  type: tag.type,
  id: tag.id,
});

const RuleEditorModal = ({
  mediaType,
  rule,
  backends,
  onClose,
  onSave,
}: RuleEditorModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [ruleType, setRuleType] = useState<BackendSelectionRuleType>(
    rule?.ruleType ?? BackendSelectionRuleType.ALLOW
  );
  const [matchType, setMatchType] = useState<BackendSelectionMatchType>(
    rule?.matchType ?? BackendSelectionMatchType.ANY
  );
  const [serviceId, setServiceId] = useState<number | null>(
    rule?.serviceId ?? backends[0]?.id ?? null
  );
  const [selectedTags, setSelectedTags] = useState<MetadataTagReference[]>(
    rule?.tags ?? []
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { data: catalog } = useSWR<MetadataTagCatalogResponse>(
    `/api/v1/backend-selection-rules/tags?mediaType=${mediaType}`
  );
  const selectedTagKeys = useMemo<Set<string>>(
    () => new Set<string>(selectedTags.map(getTagKey)),
    [selectedTags]
  );
  const catalogTagsByKey = useMemo(
    () =>
      new Map<string, MetadataTagCatalogResponse['tags'][number]>(
        (catalog?.tags ?? []).map((tag) => [getTagKey(tag), tag])
      ),
    [catalog?.tags]
  );
  const missingSelectedBackend =
    rule && !backends.some((backend) => backend.id === rule.serviceId);

  const toggleTag = (tag: MetadataTagReference): void => {
    const tagKey = getTagKey(tag);
    setSelectedTags((currentTags) =>
      currentTags.some((currentTag) => getTagKey(currentTag) === tagKey)
        ? currentTags.filter((currentTag) => getTagKey(currentTag) !== tagKey)
        : [...currentTags, toTagReference(tag)]
    );
  };

  const saveRule = async (): Promise<void> => {
    if (serviceId === null || selectedTags.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const values = {
        mediaType,
        serviceId,
        ruleType,
        matchType,
        tags: selectedTags.map(toTagReference),
      };
      if (rule) {
        await axios.put(`/api/v1/backend-selection-rules/${rule.id}`, values);
      } else {
        await axios.post('/api/v1/backend-selection-rules', values);
      }
      addToast(
        intl.formatMessage(
          rule ? messages.updateSuccess : messages.createSuccess
        ),
        { appearance: 'success', autoDismiss: true }
      );
      onSave();
    } catch {
      addToast(intl.formatMessage(messages.saveFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Transition
      as="div"
      appear
      show
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Modal
        title={intl.formatMessage(rule ? messages.editRule : messages.addRule)}
        onCancel={onClose}
        onOk={() => saveRule()}
        okText={
          isSaving
            ? intl.formatMessage(globalMessages.saving)
            : intl.formatMessage(globalMessages.save)
        }
        okDisabled={isSaving || serviceId === null || selectedTags.length === 0}
        backgroundClickable={!isSaving}
      >
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="backend-rule-type">
                {intl.formatMessage(messages.ruleType)}
              </label>
              <select
                id="backend-rule-type"
                value={ruleType}
                onChange={(event) =>
                  setRuleType(event.target.value as BackendSelectionRuleType)
                }
                className="border-gray-700 bg-gray-800"
              >
                <option value={BackendSelectionRuleType.ALLOW}>
                  {intl.formatMessage(messages.allow)}
                </option>
                <option value={BackendSelectionRuleType.BLOCK}>
                  {intl.formatMessage(messages.block)}
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {intl.formatMessage(
                  ruleType === BackendSelectionRuleType.ALLOW
                    ? messages.allowDescription
                    : messages.blockDescription
                )}
              </p>
            </div>
            <div>
              <label htmlFor="backend-match-type">
                {intl.formatMessage(messages.matchType)}
              </label>
              <select
                id="backend-match-type"
                value={matchType}
                onChange={(event) =>
                  setMatchType(event.target.value as BackendSelectionMatchType)
                }
                className="border-gray-700 bg-gray-800"
              >
                <option value={BackendSelectionMatchType.ANY}>
                  {intl.formatMessage(messages.any)}
                </option>
                <option value={BackendSelectionMatchType.ALL}>
                  {intl.formatMessage(messages.all)}
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {intl.formatMessage(
                  matchType === BackendSelectionMatchType.ANY
                    ? messages.anyDescription
                    : messages.allDescription
                )}
              </p>
            </div>
            <div>
              <label htmlFor="backend-service">
                {intl.formatMessage(messages.backend)}
              </label>
              <select
                id="backend-service"
                value={serviceId ?? ''}
                onChange={(event) => setServiceId(Number(event.target.value))}
                className="border-gray-700 bg-gray-800"
              >
                {missingSelectedBackend && rule && (
                  <option value={rule.serviceId}>
                    {intl.formatMessage(messages.missingBackend, {
                      id: rule.serviceId,
                    })}
                  </option>
                )}
                {backends.map((backend) => (
                  <option key={backend.id} value={backend.id}>
                    {backend.name}
                    {backend.is4k ? ' (4K)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-200">
              {intl.formatMessage(messages.selectedGenres)}
            </h4>
            <div className="min-h-14 rounded-md border border-gray-600 bg-gray-900/50 p-2">
              {selectedTags.length === 0 ? (
                <p className="px-1 py-2 text-sm text-gray-400">
                  {intl.formatMessage(messages.noSelectedGenres)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => {
                    const catalogTag = catalogTagsByKey.get(getTagKey(tag));
                    return (
                      <Button
                        key={getTagKey(tag)}
                        type="button"
                        buttonSize="sm"
                        onClick={() => toggleTag(tag)}
                        className="rounded-full border-indigo-400 bg-indigo-600/50"
                      >
                        <span className="mr-1 uppercase">{tag.provider}</span>
                        <span>{catalogTag?.name ?? `#${tag.id}`}</span>
                        <XMarkIcon className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-200">
              {intl.formatMessage(messages.availableGenres)}
            </h4>
            <div className="max-h-72 overflow-y-auto rounded-md border border-gray-600 bg-gray-900/40 p-3">
              {[MetadataTagProvider.TMDB, MetadataTagProvider.TVDB].map(
                (provider) => {
                  const providerTags = (catalog?.tags ?? []).filter(
                    (tag) => tag.provider === provider
                  );
                  if (providerTags.length === 0) {
                    return null;
                  }
                  return (
                    <div
                      key={provider}
                      className="mb-3 last:mb-0"
                      data-testid={`genre-cloud-${provider}`}
                    >
                      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                        {provider}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {providerTags.map((tag) => {
                          const selected = selectedTagKeys.has(getTagKey(tag));
                          return (
                            <button
                              key={getTagKey(tag)}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleTag(tag)}
                              className={`rounded px-2 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                selected
                                  ? 'bg-indigo-600 text-white ring-1 ring-indigo-400'
                                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                              }`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
              {catalog?.unavailableProviders.map((provider) => (
                <p key={provider} className="text-sm text-yellow-400">
                  {intl.formatMessage(messages.genreCatalogUnavailable, {
                    provider: provider.toUpperCase(),
                  })}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </Transition>
  );
};

export default RuleEditorModal;
