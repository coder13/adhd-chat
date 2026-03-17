import { createHmac, randomBytes } from 'node:crypto';
import { defineConfig } from 'cypress';

type ProvisionedMatrixUser = {
  baseUrl: string;
  serverName: string;
  username: string;
  password: string;
  userId: string;
};

function buildRegistrationMac(
  nonce: string,
  username: string,
  password: string,
  secret: string
) {
  return createHmac('sha1', secret)
    .update(`${nonce}\0${username}\0${password}\0notadmin`)
    .digest('hex');
}

async function provisionMatrixUser(
  baseUrl: string,
  serverName: string,
  sharedSecret: string
): Promise<ProvisionedMatrixUser> {
  const username = `cypress_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const password = `Passw0rd!${randomBytes(6).toString('hex')}`;

  const nonceResponse = await fetch(`${baseUrl}/_synapse/admin/v1/register`);
  if (!nonceResponse.ok) {
    throw new Error(
      `Failed to fetch Synapse registration nonce: ${nonceResponse.status} ${nonceResponse.statusText}`
    );
  }

  const noncePayload = (await nonceResponse.json()) as { nonce?: string };
  if (!noncePayload.nonce) {
    throw new Error('Synapse registration nonce response was missing a nonce.');
  }

  const registerResponse = await fetch(`${baseUrl}/_synapse/admin/v1/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nonce: noncePayload.nonce,
      username,
      password,
      admin: false,
      mac: buildRegistrationMac(
        noncePayload.nonce,
        username,
        password,
        sharedSecret
      ),
    }),
  });

  if (!registerResponse.ok) {
    const body = await registerResponse.text();
    throw new Error(
      `Failed to provision Synapse test user: ${registerResponse.status} ${body}`
    );
  }

  return {
    baseUrl,
    serverName,
    username,
    password,
    userId: `@${username}:${serverName}`,
  };
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:5175',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      const matrixBaseUrl =
        process.env.CYPRESS_MATRIX_BASE_URL ?? 'http://localhost:8008';
      const matrixServerName =
        process.env.CYPRESS_MATRIX_SERVER_NAME ?? 'localhost';
      const matrixSharedSecret =
        process.env.CYPRESS_MATRIX_SHARED_SECRET ?? 'dev_registration_secret';

      on('task', {
        provisionMatrixUser() {
          return provisionMatrixUser(
            matrixBaseUrl,
            matrixServerName,
            matrixSharedSecret
          );
        },
      });

      config.env.matrixBaseUrl = matrixBaseUrl;
      config.env.matrixServerName = matrixServerName;
      return config;
    },
  },
});
