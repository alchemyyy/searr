import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import filterPresetRoutes from './filterPreset';

let application: Express;

function createApplication(): Express {
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
  testApplication.use('/filter-presets', isAuthenticated(), filterPresetRoutes);
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
}

before(() => {
  application = createApplication();
});

setupTestDb();

async function loginAs(
  email: string,
  password: string
): Promise<request.Agent> {
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
}

describe('filter presets', () => {
  it('allows every authenticated user to load the global preset pool', async () => {
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const createResponse = await adminAgent.post('/filter-presets').send({
      name: 'Highly Rated',
      filters: { voteAverageGte: '8' },
    });
    assert.strictEqual(createResponse.status, 201);

    const friendAgent = await loginAs('friend@seerr.dev', 'test1234');
    const listResponse = await friendAgent.get('/filter-presets');

    assert.strictEqual(listResponse.status, 200);
    assert.strictEqual(listResponse.body.length, 1);
    assert.strictEqual(listResponse.body[0].name, 'Highly Rated');
    assert.deepStrictEqual(listResponse.body[0].filters, {
      voteAverageGte: '8',
    });
  });

  it('requires the filter preset permission to save presets', async () => {
    const friendAgent = await loginAs('friend@seerr.dev', 'test1234');
    const forbiddenResponse = await friendAgent.post('/filter-presets').send({
      name: 'Short',
      filters: { withRuntimeLte: '90' },
    });
    assert.strictEqual(forbiddenResponse.status, 403);

    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions += Permission.VOTE;
    await userRepository.save(friend);

    const legacyPermissionAgent = await loginAs('friend@seerr.dev', 'test1234');
    const legacyPermissionResponse = await legacyPermissionAgent
      .post('/filter-presets')
      .send({
        name: 'Still Forbidden',
        filters: { withRuntimeLte: '90' },
      });
    assert.strictEqual(legacyPermissionResponse.status, 403);

    friend.permissions += Permission.MANAGE_FILTER_PRESETS;
    await userRepository.save(friend);

    const permittedAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createResponse = await permittedAgent.post('/filter-presets').send({
      name: 'Short',
      filters: { withRuntimeLte: '90' },
    });

    assert.strictEqual(createResponse.status, 201);
    const deleteResponse = await permittedAgent.delete(
      `/filter-presets/${createResponse.body.id}`
    );
    assert.strictEqual(deleteResponse.status, 204);
  });

  it('rejects duplicate names and unsupported filter values', async () => {
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const firstResponse = await adminAgent.post('/filter-presets').send({
      name: 'Popular',
      filters: { sortBy: 'popularity.desc' },
    });
    assert.strictEqual(firstResponse.status, 201);

    const duplicateResponse = await adminAgent.post('/filter-presets').send({
      name: 'popular',
      filters: { sortBy: 'popularity.asc' },
    });
    assert.strictEqual(duplicateResponse.status, 409);

    const invalidResponse = await adminAgent.post('/filter-presets').send({
      name: 'Invalid',
      filters: { unsupportedFilter: 'value' },
    });
    assert.strictEqual(invalidResponse.status, 400);

    const invalidMaximumResponse = await adminAgent
      .post('/filter-presets')
      .send({
        name: 'Invalid Maximum',
        filters: { voteAverageLte: '11' },
      });
    assert.strictEqual(invalidMaximumResponse.status, 400);

    const emptyResponse = await adminAgent.post('/filter-presets').send({
      name: 'Empty',
      filters: {},
    });
    assert.strictEqual(emptyResponse.status, 400);
  });

  it('keeps movie and series defaults independent', async () => {
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const firstPresetResponse = await adminAgent.post('/filter-presets').send({
      name: 'First',
      filters: { voteCountGte: '100' },
    });
    const secondPresetResponse = await adminAgent.post('/filter-presets').send({
      name: 'Second',
      filters: { voteAverageGte: '7' },
    });

    const firstPresetId = firstPresetResponse.body.id as number;
    const secondPresetId = secondPresetResponse.body.id as number;
    assert.strictEqual(
      (
        await adminAgent
          .put('/filter-presets/default/movie')
          .send({ presetId: firstPresetId })
      ).status,
      200
    );
    assert.strictEqual(
      (
        await adminAgent
          .put('/filter-presets/default/tv')
          .send({ presetId: secondPresetId })
      ).status,
      200
    );
    assert.strictEqual(
      (
        await adminAgent
          .put('/filter-presets/default/movie')
          .send({ presetId: secondPresetId })
      ).status,
      200
    );

    const listResponse = await adminAgent.get('/filter-presets');
    const firstPreset = listResponse.body.find(
      (filterPreset: { id: number }) => filterPreset.id === firstPresetId
    );
    const secondPreset = listResponse.body.find(
      (filterPreset: { id: number }) => filterPreset.id === secondPresetId
    );

    assert.strictEqual(firstPreset.isDefaultMovie, false);
    assert.strictEqual(firstPreset.isDefaultTv, false);
    assert.strictEqual(secondPreset.isDefaultMovie, true);
    assert.strictEqual(secondPreset.isDefaultTv, true);

    const clearMovieDefaultResponse = await adminAgent
      .put('/filter-presets/default/movie')
      .send({ presetId: null });
    assert.strictEqual(clearMovieDefaultResponse.status, 200);

    const updatedListResponse = await adminAgent.get('/filter-presets');
    const updatedSecondPreset = updatedListResponse.body.find(
      (filterPreset: { id: number }) => filterPreset.id === secondPresetId
    );
    assert.strictEqual(updatedSecondPreset.isDefaultMovie, false);
    assert.strictEqual(updatedSecondPreset.isDefaultTv, true);
  });

  it('does not let preset managers change global defaults', async () => {
    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions += Permission.MANAGE_FILTER_PRESETS;
    await userRepository.save(friend);

    const friendAgent = await loginAs('friend@seerr.dev', 'test1234');
    const response = await friendAgent
      .put('/filter-presets/default/movie')
      .send({ presetId: null });

    assert.strictEqual(response.status, 403);
  });

  it('rejects defaults that have no applicable section filters', async () => {
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const presetResponse = await adminAgent.post('/filter-presets').send({
      name: 'Series Status',
      filters: { status: '0' },
    });

    const response = await adminAgent
      .put('/filter-presets/default/movie')
      .send({ presetId: presetResponse.body.id });

    assert.strictEqual(response.status, 400);
  });
});
