import * as sdk from 'matrix-js-sdk';

export interface MatrixChatClientConfig {
  baseUrl: string;
  userId?: string;
  accessToken?: string;
}

export class MatrixChatClient {
  private client: sdk.MatrixClient | null = null;
  private config: MatrixChatClientConfig;

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
