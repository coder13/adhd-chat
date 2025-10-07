import * as sdk from 'matrix-js-sdk';
import { OIDCClient } from './oidc-client';
import type { OIDCConfig } from './oidc-client';

export interface MatrixChatClientConfig {
  baseUrl: string;
  userId?: string;
  accessToken?: string;
}

export interface OIDCLoginConfig extends OIDCConfig {
  baseUrl: string;
}

export class MatrixChatClient {
  private client: sdk.MatrixClient | null = null;
  private config: MatrixChatClientConfig;
  private oidcClient: OIDCClient | null = null;

  constructor(config: MatrixChatClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.accessToken && this.config.userId) {
      this.client = sdk.createClient({
        baseUrl: this.config.baseUrl,
        accessToken: this.config.accessToken,
        userId: this.config.userId,
      });
    } else {
      this.client = sdk.createClient({
        baseUrl: this.config.baseUrl,
      });
    }
  }

  async login(username: string, password: string): Promise<void> {
    if (!this.client) {
      await this.initialize();
    }

    const response = await this.client!.login('m.login.password', {
      user: username,
      password: password,
    });

    this.config.userId = response.user_id;
    this.config.accessToken = response.access_token;

    // Reinitialize with credentials
    await this.initialize();
  }

  async loginWithOIDC(oidcConfig: OIDCConfig): Promise<void> {
    this.oidcClient = new OIDCClient(oidcConfig);
    await this.oidcClient.initialize();
    await this.oidcClient.startLogin();
  }

  async completeOIDCLogin(): Promise<void> {
    if (!this.oidcClient) {
      throw new Error('OIDC client not initialized');
    }

    const result = await this.oidcClient.completeLogin();
    
    this.config.userId = result.userId;
    this.config.accessToken = result.accessToken;

    // Reinitialize with OIDC credentials
    await this.initialize();
  }

  async startSync(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.startClient();
  }

  async stopSync(): Promise<void> {
    if (!this.client) {
      return;
    }
    this.client.stopClient();
  }

  getClient(): sdk.MatrixClient | null {
    return this.client;
  }
}
