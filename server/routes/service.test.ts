import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import serviceRoutes from './service';

let app: Express;

function createApp(): Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  testApp.use(checkUser);
  testApp.use('/auth', authRoutes);
  testApp.use('/service', serviceRoutes);
  testApp.use(
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

  return testApp;
}

before(() => {
  app = createApp();
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
    const agent = request.agent(app);
    const response = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(response.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

describe('manual import service permission', () => {
  it('rejects users without the Manual Imports permission', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const radarrResponse = await agent
      .post('/service/radarr/999/manual-import')
      .send({ downloadId: 'download-id' });
    const sonarrResponse = await agent
      .post('/service/sonarr/999/manual-import')
      .send({ downloadId: 'download-id' });

    assert.strictEqual(radarrResponse.status, 403);
    assert.strictEqual(sonarrResponse.status, 403);
  });

  it('allows explicitly permitted users to reach the Radarr handler', async () => {
    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions = Permission.MANUAL_IMPORT;
    await userRepository.save(friend);

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const response = await agent
      .post('/service/radarr/999/manual-import')
      .send({ downloadId: 'download-id' });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(
      response.body.message,
      'Radarr server with provided ID does not exist.'
    );
  });

  it('allows explicitly permitted users to reach the Sonarr handler', async () => {
    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions = Permission.MANUAL_IMPORT;
    await userRepository.save(friend);

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const response = await agent
      .post('/service/sonarr/999/manual-import')
      .send({ downloadId: 'download-id' });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(
      response.body.message,
      'Sonarr server with provided ID does not exist.'
    );
  });
});
