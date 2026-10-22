import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { MediaType } from '@server/constants/media';
import {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagProvider,
  MetadataTagType,
} from '@server/entity/BackendSelectionRule';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import backendSelectionRoutes from './backendSelection';

let application: Express;

const tmdbAnimation = {
  provider: MetadataTagProvider.TMDB,
  type: MetadataTagType.GENRE,
  id: 16,
};

const configureServices = (): void => {
  const settings = getSettings();
  settings.radarr = [
    {
      id: 0,
      name: 'Default Radarr',
      hostname: 'localhost',
      port: 7878,
      apiKey: 'test-key',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/movies',
      minimumAvailability: 'released',
      tags: [],
      is4k: false,
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
    },
    {
      id: 1,
      name: 'Anime Radarr',
      hostname: 'localhost',
      port: 7879,
      apiKey: 'test-key',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/anime-movies',
      minimumAvailability: 'released',
      tags: [],
      is4k: false,
      isDefault: false,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
    },
  ] as RadarrSettings[];
  settings.sonarr = [
    {
      id: 0,
      name: 'Default Sonarr',
      hostname: 'localhost',
      port: 8989,
      apiKey: 'test-key',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/series',
      tags: [],
      is4k: false,
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
      seriesType: 'standard',
      animeSeriesType: 'anime',
      animeTags: [],
      enableSeasonFolders: true,
      monitorNewItems: 'all',
    },
    {
      id: 1,
      name: 'Anime Sonarr',
      hostname: 'localhost',
      port: 8990,
      apiKey: 'test-key',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/anime',
      tags: [],
      is4k: false,
      isDefault: false,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
      seriesType: 'anime',
      animeSeriesType: 'anime',
      animeTags: [],
      enableSeasonFolders: true,
      monitorNewItems: 'all',
    },
  ] as SonarrSettings[];
};

const createApplication = (): Express => {
  const testApplication = express();
  testApplication.use(express.json());
  testApplication.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  testApplication.use(checkUser);
  testApplication.use('/auth', authRoutes);
  testApplication.use(
    '/backend-selection-rules',
    isAuthenticated(),
    backendSelectionRoutes
  );
  testApplication.use(
    (
      error: { status?: number; message?: string },
      _request: express.Request,
      response: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      response.status(error.status ?? 500).json({
        status: error.status ?? 500,
        message: error.message,
      });
    }
  );
  return testApplication;
};

before(() => {
  application = createApplication();
});

setupTestDb();

const loginAs = async (
  email: string,
  password: string
): Promise<request.Agent> => {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(application);
    const response = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(response.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
};

const createRule = async (
  agent: request.Agent,
  values: Record<string, unknown> = {}
): Promise<request.Response> =>
  agent.post('/backend-selection-rules').send({
    mediaType: MediaType.TV,
    serviceId: 1,
    ruleType: BackendSelectionRuleType.ALLOW,
    matchType: BackendSelectionMatchType.ANY,
    tags: [tmdbAnimation],
    ...values,
  });

describe('backend selection routes', () => {
  it('restricts rule administration to server administrators', async () => {
    configureServices();
    const friendAgent = await loginAs('demo@seerr.dev', 'test1234');
    const response = await friendAgent.get('/backend-selection-rules');

    assert.strictEqual(response.status, 403);
  });

  it('allows multiple ordered rules to target the same backend', async () => {
    configureServices();
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const firstResponse = await createRule(adminAgent);
    const secondResponse = await createRule(adminAgent, {
      matchType: BackendSelectionMatchType.ALL,
    });

    assert.strictEqual(firstResponse.status, 201);
    assert.strictEqual(secondResponse.status, 201);
    assert.strictEqual(firstResponse.body.position, 0);
    assert.strictEqual(secondResponse.body.position, 1);

    const reorderResponse = await adminAgent
      .put(`/backend-selection-rules/order/${MediaType.TV}`)
      .send({ ruleIds: [secondResponse.body.id, firstResponse.body.id] });
    assert.strictEqual(reorderResponse.status, 200);
    assert.deepStrictEqual(
      reorderResponse.body.map((rule: { id: number }) => rule.id),
      [secondResponse.body.id, firstResponse.body.id]
    );
  });

  it('validates services, tags, and complete reorder lists', async () => {
    configureServices();
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const emptyTagsResponse = await createRule(adminAgent, { tags: [] });
    const wrongServiceResponse = await createRule(adminAgent, {
      mediaType: MediaType.MOVIE,
      serviceId: 999,
    });
    const ruleResponse = await createRule(adminAgent);
    const incompleteOrderResponse = await adminAgent
      .put(`/backend-selection-rules/order/${MediaType.TV}`)
      .send({ ruleIds: [] });

    assert.strictEqual(emptyTagsResponse.status, 400);
    assert.strictEqual(wrongServiceResponse.status, 400);
    assert.strictEqual(ruleResponse.status, 201);
    assert.strictEqual(incompleteOrderResponse.status, 400);
  });

  it('returns recommendations to authenticated requesters', async () => {
    configureServices();
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    assert.strictEqual((await createRule(adminAgent)).status, 201);

    const friendAgent = await loginAs('demo@seerr.dev', 'test1234');
    const response = await friendAgent
      .post('/backend-selection-rules/recommendation')
      .send({
        mediaType: MediaType.TV,
        is4k: false,
        tags: [tmdbAnimation],
      });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.serverId, 1);
    assert.strictEqual(typeof response.body.matchedRuleId, 'number');
  });

  it('does not confuse equal genre IDs from different providers', async () => {
    configureServices();
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    await createRule(adminAgent, {
      tags: [
        {
          provider: MetadataTagProvider.TVDB,
          type: MetadataTagType.GENRE,
          id: 16,
        },
      ],
    });

    const response = await adminAgent
      .post('/backend-selection-rules/recommendation')
      .send({
        mediaType: MediaType.TV,
        is4k: false,
        tags: [tmdbAnimation],
      });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.serverId, 0);
    assert.strictEqual(response.body.matchedRuleId, null);
  });
});
