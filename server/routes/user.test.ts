import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import userRoutes from './user';

let app: Express;
type RequestAgent = ReturnType<typeof request.agent>;

/** Create the route subset needed for user creation tests. */
function createApp(): Express {
  const testApp: Express = express();
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
  testApp.use('/user', isAuthenticated(), userRoutes);
  testApp.use(
    (
      error: { status?: number; message?: string },
      _request: express.Request,
      response: express.Response,
      // Express identifies error handlers by their four-argument signature
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

/** Authenticate as the seeded administrator. */
async function authenticatedAdmin(): Promise<RequestAgent> {
  const agent: RequestAgent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;

  const response = await agent.post('/auth/local').send({
    email: 'admin@seerr.dev',
    password: 'test1234',
  });
  assert.strictEqual(response.status, 200);

  return agent;
}

before(() => {
  app = createApp();
});

setupTestDb();

describe('POST /user', () => {
  it('creates a usable local account without an email address', async () => {
    const agent: RequestAgent = await authenticatedAdmin();
    const username = 'email-free-user';
    const password = 'test1234';

    const createResponse = await agent.post('/user').send({
      username,
      password,
    });

    assert.strictEqual(createResponse.status, 201);
    assert.strictEqual(createResponse.body.username, username);

    const user = await getRepository(User).findOneOrFail({
      where: { email: username },
      select: ['id', 'email', 'password'],
    });
    assert.strictEqual(user.email, username);
    assert.ok(await user.passwordMatch(password));

    const loginResponse = await request(app).post('/auth/local').send({
      email: username,
      password,
    });
    assert.strictEqual(loginResponse.status, 200);
  });

  it('requires a password when the email address is omitted', async () => {
    const agent: RequestAgent = await authenticatedAdmin();

    const response = await agent.post('/user').send({
      username: 'missing-password-user',
    });

    assert.strictEqual(response.status, 400);
    assert.match(response.body.message, /password is required/i);
  });
});
