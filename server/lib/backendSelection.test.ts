import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MediaType } from '@server/constants/media';
import BackendSelectionRule, {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagProvider,
  MetadataTagType,
  type MetadataTagReference,
} from '@server/entity/BackendSelectionRule';
import {
  doesBackendSelectionRuleMatch,
  selectBackendForMetadata,
  type SelectableBackend,
} from '@server/lib/backendSelection';

const tmdbAnimation: MetadataTagReference = {
  provider: MetadataTagProvider.TMDB,
  type: MetadataTagType.GENRE,
  id: 16,
};
const tvdbAnime: MetadataTagReference = {
  provider: MetadataTagProvider.TVDB,
  type: MetadataTagType.GENRE,
  id: 16,
};
const tmdbComedy: MetadataTagReference = {
  provider: MetadataTagProvider.TMDB,
  type: MetadataTagType.GENRE,
  id: 35,
};

const createRule = (
  values: Partial<BackendSelectionRule> = {}
): BackendSelectionRule =>
  new BackendSelectionRule({
    id: 1,
    mediaType: MediaType.TV,
    serviceId: 1,
    ruleType: BackendSelectionRuleType.ALLOW,
    matchType: BackendSelectionMatchType.ANY,
    tags: [tmdbAnimation],
    position: 0,
    ...values,
  });

const backends: SelectableBackend[] = [
  { id: 0, is4k: false, isDefault: true },
  { id: 1, is4k: false, isDefault: false },
  { id: 2, is4k: true, isDefault: true },
];

describe('backend selection', () => {
  it('keeps metadata provider identifiers distinct', () => {
    const rule = createRule({ tags: [tvdbAnime] });

    assert.strictEqual(
      doesBackendSelectionRuleMatch(rule, [tmdbAnimation]),
      false
    );
    assert.strictEqual(doesBackendSelectionRuleMatch(rule, [tvdbAnime]), true);
  });

  it('supports ANY and ALL tag collection matching', () => {
    const anyRule = createRule({
      matchType: BackendSelectionMatchType.ANY,
      tags: [tmdbAnimation, tmdbComedy],
    });
    const allRule = createRule({
      matchType: BackendSelectionMatchType.ALL,
      tags: [tmdbAnimation, tmdbComedy],
    });

    assert.strictEqual(
      doesBackendSelectionRuleMatch(anyRule, [tmdbComedy]),
      true
    );
    assert.strictEqual(
      doesBackendSelectionRuleMatch(allRule, [tmdbComedy]),
      false
    );
    assert.strictEqual(
      doesBackendSelectionRuleMatch(allRule, [tmdbAnimation, tmdbComedy]),
      true
    );
  });

  it('uses priority order and allows multiple rules for one backend', () => {
    const recommendation = selectBackendForMetadata({
      mediaType: MediaType.TV,
      is4k: false,
      metadataTags: [tmdbAnimation, tmdbComedy],
      rules: [
        createRule({ id: 2, position: 2, tags: [tmdbComedy] }),
        createRule({ id: 1, position: 1, tags: [tmdbAnimation] }),
      ],
      backends,
    });

    assert.deepStrictEqual(recommendation, {
      serverId: 1,
      matchedRuleId: 1,
    });
  });

  it('applies BLOCK rules before later ALLOW rules', () => {
    const recommendation = selectBackendForMetadata({
      mediaType: MediaType.TV,
      is4k: false,
      metadataTags: [tmdbAnimation, tmdbComedy],
      rules: [
        createRule({
          id: 1,
          position: 0,
          ruleType: BackendSelectionRuleType.BLOCK,
          tags: [tmdbComedy],
        }),
        createRule({ id: 2, position: 1, tags: [tmdbAnimation] }),
      ],
      backends,
    });

    assert.deepStrictEqual(recommendation, {
      serverId: 0,
      matchedRuleId: null,
    });
  });

  it('only recommends backends matching the request resolution', () => {
    const recommendation = selectBackendForMetadata({
      mediaType: MediaType.TV,
      is4k: true,
      metadataTags: [tmdbAnimation],
      rules: [createRule()],
      backends,
    });

    assert.deepStrictEqual(recommendation, {
      serverId: 2,
      matchedRuleId: null,
    });
  });

  it('returns no preselection when the default backend is blocked', () => {
    const recommendation = selectBackendForMetadata({
      mediaType: MediaType.TV,
      is4k: false,
      metadataTags: [tmdbAnimation],
      rules: [
        createRule({
          serviceId: 0,
          ruleType: BackendSelectionRuleType.BLOCK,
        }),
      ],
      backends,
    });

    assert.deepStrictEqual(recommendation, {
      serverId: null,
      matchedRuleId: null,
    });
  });
});
