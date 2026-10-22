import type { MediaType } from '@server/constants/media';
import type BackendSelectionRule from '@server/entity/BackendSelectionRule';
import {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  type MetadataTagReference,
} from '@server/entity/BackendSelectionRule';
import type { BackendSelectionRecommendationResponse } from '@server/interfaces/api/backendSelectionInterfaces';

export interface SelectableBackend {
  id: number;
  is4k: boolean;
  isDefault: boolean;
}

const getMetadataTagKey = (tag: MetadataTagReference): string =>
  `${tag.provider}:${tag.type}:${tag.id}`;

export const doesBackendSelectionRuleMatch = (
  rule: BackendSelectionRule,
  metadataTags: MetadataTagReference[]
): boolean => {
  const metadataTagKeys = new Set<string>(metadataTags.map(getMetadataTagKey));
  const ruleTagKeys = rule.tags.map(getMetadataTagKey);

  switch (rule.matchType) {
    case BackendSelectionMatchType.ANY:
      return ruleTagKeys.some((tagKey) => metadataTagKeys.has(tagKey));
    case BackendSelectionMatchType.ALL:
      return ruleTagKeys.every((tagKey) => metadataTagKeys.has(tagKey));
  }
};

/** Applies ordered backend rules and falls back to the configured default. */
export const selectBackendForMetadata = ({
  mediaType,
  is4k,
  metadataTags,
  rules,
  backends,
}: {
  mediaType: MediaType;
  is4k: boolean;
  metadataTags: MetadataTagReference[];
  rules: BackendSelectionRule[];
  backends: SelectableBackend[];
}): BackendSelectionRecommendationResponse => {
  const compatibleBackends = new Map<number, SelectableBackend>();
  backends
    .filter((backend) => backend.is4k === is4k)
    .forEach((backend) => compatibleBackends.set(backend.id, backend));

  const blockedBackendIds = new Set<number>();
  const orderedRules = [...rules]
    .filter((rule) => rule.mediaType === mediaType)
    .sort(
      (firstRule, secondRule) =>
        firstRule.position - secondRule.position || firstRule.id - secondRule.id
    );

  for (const rule of orderedRules) {
    if (!doesBackendSelectionRuleMatch(rule, metadataTags)) {
      continue;
    }

    switch (rule.ruleType) {
      case BackendSelectionRuleType.BLOCK:
        blockedBackendIds.add(rule.serviceId);
        break;
      case BackendSelectionRuleType.ALLOW:
        if (
          compatibleBackends.has(rule.serviceId) &&
          !blockedBackendIds.has(rule.serviceId)
        ) {
          return {
            serverId: rule.serviceId,
            matchedRuleId: rule.id,
          };
        }
        break;
    }
  }

  const defaultBackend = [...compatibleBackends.values()].find(
    (backend) => backend.isDefault && !blockedBackendIds.has(backend.id)
  );

  return {
    serverId: defaultBackend?.id ?? null,
    matchedRuleId: null,
  };
};
