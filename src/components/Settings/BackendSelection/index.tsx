import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import RuleEditorModal from '@app/components/Settings/BackendSelection/RuleEditorModal';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  type MetadataTagReference,
} from '@server/constants/backendSelection';
import { MediaType } from '@server/constants/media';
import type BackendSelectionRule from '@server/entity/BackendSelectionRule';
import type {
  BackendSelectionRuleResultsResponse,
  MetadataTagCatalogResponse,
} from '@server/interfaces/api/backendSelectionInterfaces';
import type {
  DVRSettings,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.BackendSelection', {
  title: 'Backend Defaults',
  description:
    'Preselect a Radarr or Sonarr backend from external metadata genres. Users with advanced request access can override the selection before submitting.',
  movies: 'Movies / Radarr',
  series: 'Series / Sonarr',
  movieDescription:
    'Rules are evaluated from top to bottom for new movie requests.',
  seriesDescription:
    'Rules are evaluated from top to bottom for new series requests.',
  addRule: 'Add Rule',
  noRules: 'No backend defaults have been configured for this media type.',
  allow: 'ALLOW',
  block: 'BLOCK',
  any: 'ANY',
  all: 'ALL',
  missingBackend: 'Missing backend (#{id})',
  moveUp: 'Move rule up',
  moveDown: 'Move rule down',
  editRule: 'Edit rule',
  deleteRule: 'Delete rule',
  deleteTitle: 'Delete Backend Default',
  deleteConfirmation:
    'Delete this backend default? This does not affect existing requests.',
  deleteSuccess: 'Backend default deleted.',
  deleteFailed: 'Unable to delete the backend default.',
  reorderFailed: 'Unable to reorder backend defaults.',
});

type BackendSummary = Pick<DVRSettings, 'id' | 'name' | 'is4k'>;

interface RuleSectionProps {
  mediaType: MediaType;
  title: string;
  description: string;
  rules: BackendSelectionRule[];
  backends: BackendSummary[];
  catalog?: MetadataTagCatalogResponse;
  isReordering: boolean;
  onAdd: () => void;
  onEdit: (rule: BackendSelectionRule) => void;
  onDelete: (rule: BackendSelectionRule) => void;
  onMove: (ruleIndex: number, direction: -1 | 1) => void;
}

const getTagKey = (tag: MetadataTagReference): string =>
  `${tag.provider}:${tag.type}:${tag.id}`;

const RuleSection = ({
  title,
  description,
  rules,
  backends,
  catalog,
  isReordering,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: RuleSectionProps) => {
  const intl = useIntl();
  const tagNames = new Map<string, string>(
    (catalog?.tags ?? []).map((tag) => [getTagKey(tag), tag.name])
  );

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="heading">{title}</h3>
          <p className="description">{description}</p>
        </div>
        <Button
          buttonType="primary"
          onClick={onAdd}
          disabled={backends.length === 0}
        >
          <PlusIcon />
          <span>{intl.formatMessage(messages.addRule)}</span>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-600 px-4 py-10 text-center text-sm text-gray-400">
          {intl.formatMessage(messages.noRules)}
        </div>
      ) : (
        <ol className="space-y-2">
          {rules.map((rule, ruleIndex) => {
            const backend = backends.find(
              (candidate) => candidate.id === rule.serviceId
            );
            return (
              <li
                key={rule.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow sm:flex-row sm:items-center"
              >
                <div className="flex shrink-0 items-center gap-1">
                  <span className="w-7 text-center text-sm font-semibold text-gray-400">
                    {ruleIndex + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      title={intl.formatMessage(messages.moveUp)}
                      aria-label={intl.formatMessage(messages.moveUp)}
                      disabled={ruleIndex === 0 || isReordering}
                      onClick={() => onMove(ruleIndex, -1)}
                      className="rounded bg-gray-700 p-1 text-gray-200 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={intl.formatMessage(messages.moveDown)}
                      aria-label={intl.formatMessage(messages.moveDown)}
                      disabled={ruleIndex === rules.length - 1 || isReordering}
                      onClick={() => onMove(ruleIndex, 1)}
                      className="rounded bg-gray-700 p-1 text-gray-200 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      badgeType={
                        rule.ruleType === BackendSelectionRuleType.ALLOW
                          ? 'success'
                          : 'danger'
                      }
                    >
                      {intl.formatMessage(
                        rule.ruleType === BackendSelectionRuleType.ALLOW
                          ? messages.allow
                          : messages.block
                      )}
                    </Badge>
                    <Badge badgeType="light">
                      {intl.formatMessage(
                        rule.matchType === BackendSelectionMatchType.ANY
                          ? messages.any
                          : messages.all
                      )}
                    </Badge>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rule.tags.map((tag, tagIndex) => (
                        <span
                          key={getTagKey(tag)}
                          className="inline-flex items-center"
                        >
                          {tagIndex > 0 && (
                            <span className="mr-1.5 text-[10px] font-bold text-gray-500">
                              {rule.matchType.toUpperCase()}
                            </span>
                          )}
                          <span className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-100">
                            <span className="mr-1 font-semibold uppercase text-gray-400">
                              {tag.provider}
                            </span>
                            {tagNames.get(getTagKey(tag)) ?? `#${tag.id}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <ArrowRightIcon className="h-4 w-4 text-gray-500" />
                    <span className={backend ? '' : 'text-red-300'}>
                      {backend
                        ? `${backend.name}${backend.is4k ? ' (4K)' : ''}`
                        : intl.formatMessage(messages.missingBackend, {
                            id: rule.serviceId,
                          })}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 sm:self-center">
                  <Button
                    buttonSize="sm"
                    title={intl.formatMessage(messages.editRule)}
                    aria-label={intl.formatMessage(messages.editRule)}
                    onClick={() => onEdit(rule)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    title={intl.formatMessage(messages.deleteRule)}
                    aria-label={intl.formatMessage(messages.deleteRule)}
                    onClick={() => onDelete(rule)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

const SettingsBackendSelection = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const {
    data: rules,
    error: rulesError,
    mutate: revalidateRules,
  } = useSWR<BackendSelectionRuleResultsResponse>(
    '/api/v1/backend-selection-rules'
  );
  const { data: radarrBackends } = useSWR<RadarrSettings[]>(
    '/api/v1/settings/radarr'
  );
  const { data: sonarrBackends } = useSWR<SonarrSettings[]>(
    '/api/v1/settings/sonarr'
  );
  const { data: movieCatalog } = useSWR<MetadataTagCatalogResponse>(
    `/api/v1/backend-selection-rules/tags?mediaType=${MediaType.MOVIE}`
  );
  const { data: seriesCatalog } = useSWR<MetadataTagCatalogResponse>(
    `/api/v1/backend-selection-rules/tags?mediaType=${MediaType.TV}`
  );
  const [editor, setEditor] = useState<{
    mediaType: MediaType;
    rule: BackendSelectionRule | null;
  } | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<BackendSelectionRule | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [reorderingMediaType, setReorderingMediaType] =
    useState<MediaType | null>(null);

  if (!rules && !rulesError) {
    return <LoadingSpinner />;
  }

  const getRules = (mediaType: MediaType): BackendSelectionRule[] =>
    (rules ?? [])
      .filter((rule) => rule.mediaType === mediaType)
      .toSorted(
        (firstRule, secondRule) =>
          firstRule.position - secondRule.position ||
          firstRule.id - secondRule.id
      );

  const moveRule = async (
    mediaType: MediaType,
    ruleIndex: number,
    direction: -1 | 1
  ): Promise<void> => {
    const orderedRules = getRules(mediaType);
    const targetIndex = ruleIndex + direction;
    if (targetIndex < 0 || targetIndex >= orderedRules.length) {
      return;
    }

    const movedRule = orderedRules[ruleIndex];
    orderedRules[ruleIndex] = orderedRules[targetIndex];
    orderedRules[targetIndex] = movedRule;
    setReorderingMediaType(mediaType);
    try {
      await axios.put(`/api/v1/backend-selection-rules/order/${mediaType}`, {
        ruleIds: orderedRules.map((rule) => rule.id),
      });
      await revalidateRules();
    } catch {
      addToast(intl.formatMessage(messages.reorderFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setReorderingMediaType(null);
    }
  };

  const deleteRule = async (): Promise<void> => {
    if (!ruleToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await axios.delete(`/api/v1/backend-selection-rules/${ruleToDelete.id}`);
      await revalidateRules();
      setRuleToDelete(null);
      addToast(intl.formatMessage(messages.deleteSuccess), {
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

  const editorBackends =
    editor?.mediaType === MediaType.MOVIE
      ? (radarrBackends ?? [])
      : (sonarrBackends ?? []);

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.title),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-8">
        <h2 className="heading">{intl.formatMessage(messages.title)}</h2>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>

      <RuleSection
        mediaType={MediaType.MOVIE}
        title={intl.formatMessage(messages.movies)}
        description={intl.formatMessage(messages.movieDescription)}
        rules={getRules(MediaType.MOVIE)}
        backends={radarrBackends ?? []}
        catalog={movieCatalog}
        isReordering={reorderingMediaType === MediaType.MOVIE}
        onAdd={() => setEditor({ mediaType: MediaType.MOVIE, rule: null })}
        onEdit={(rule) => setEditor({ mediaType: MediaType.MOVIE, rule })}
        onDelete={setRuleToDelete}
        onMove={(ruleIndex, direction) =>
          moveRule(MediaType.MOVIE, ruleIndex, direction)
        }
      />

      <RuleSection
        mediaType={MediaType.TV}
        title={intl.formatMessage(messages.series)}
        description={intl.formatMessage(messages.seriesDescription)}
        rules={getRules(MediaType.TV)}
        backends={sonarrBackends ?? []}
        catalog={seriesCatalog}
        isReordering={reorderingMediaType === MediaType.TV}
        onAdd={() => setEditor({ mediaType: MediaType.TV, rule: null })}
        onEdit={(rule) => setEditor({ mediaType: MediaType.TV, rule })}
        onDelete={setRuleToDelete}
        onMove={(ruleIndex, direction) =>
          moveRule(MediaType.TV, ruleIndex, direction)
        }
      />

      {editor && (
        <RuleEditorModal
          mediaType={editor.mediaType}
          rule={editor.rule}
          backends={editorBackends}
          onClose={() => setEditor(null)}
          onSave={() => {
            setEditor(null);
            revalidateRules();
          }}
        />
      )}

      {ruleToDelete && (
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
            title={intl.formatMessage(messages.deleteTitle)}
            onCancel={() => setRuleToDelete(null)}
            onOk={() => deleteRule()}
            okText={intl.formatMessage(globalMessages.delete)}
            okButtonType="danger"
            okDisabled={isDeleting}
            backgroundClickable={!isDeleting}
          >
            <p className="mt-6">
              {intl.formatMessage(messages.deleteConfirmation)}
            </p>
          </Modal>
        </Transition>
      )}
    </>
  );
};

export default SettingsBackendSelection;
