import type BackendSelectionRule from '@server/entity/BackendSelectionRule';
import type {
  MetadataTagProvider,
  MetadataTagReference,
  MetadataTagType,
} from '@server/entity/BackendSelectionRule';

export interface MetadataTag extends MetadataTagReference {
  name: string;
}

export interface MetadataTagCatalogEntry {
  provider: MetadataTagProvider;
  type: MetadataTagType;
  id: number;
  name: string;
}

export interface MetadataTagCatalogResponse {
  tags: MetadataTagCatalogEntry[];
  unavailableProviders: MetadataTagProvider[];
}

export interface BackendSelectionRecommendationResponse {
  serverId: number | null;
  matchedRuleId: number | null;
}

export type BackendSelectionRuleResultsResponse = BackendSelectionRule[];
