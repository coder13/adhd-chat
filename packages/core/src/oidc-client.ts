import { UserManager, User } from 'oidc-client-ts';
import type { UserManagerSettings } from 'oidc-client-ts';

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
}

export interface OIDCLoginResult {
  accessToken: string;
  userId: string;
  deviceId?: string;
}

export class OIDCClient {
  private userManager: UserManager | null = null;
  private config: OIDCConfig;

  constructor(config: OIDCConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const settings: UserManagerSettings = {
      authority: this.config.issuer,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope || 'openid urn:matrix:org.matrix.msc2967.client:api:*',
      post_logout_redirect_uri: this.config.redirectUri,
      automaticSilentRenew: true,
    };

    this.userManager = new UserManager(settings);
  }

  async startLogin(): Promise<void> {
    if (!this.userManager) {
      await this.initialize();
    }
    await this.userManager!.signinRedirect();
  }

  async completeLogin(): Promise<OIDCLoginResult> {
    if (!this.userManager) {
      await this.initialize();
    }

    const user: User = await this.userManager!.signinRedirectCallback();

    if (!user || !user.access_token) {
      throw new Error('No access token received from OIDC provider');
    }

    // Extract Matrix-specific information from the token or profile
    const userId = user.profile.sub;
    
    return {
      accessToken: user.access_token,
      userId: userId || '',
      deviceId: this.extractDeviceId(user),
    };
  }

  private extractDeviceId(user: User): string | undefined {
    // Extract device ID from scope if present
    const scope = user.scope || '';
    const deviceMatch = scope.match(/urn:matrix:org\.matrix\.msc2967\.client:device:([^:\s]+)/);
    return deviceMatch ? deviceMatch[1] : undefined;
  }

  async logout(): Promise<void> {
    if (this.userManager) {
      await this.userManager.signoutRedirect();
    }
  }

  async getUser(): Promise<User | null> {
    if (!this.userManager) {
      return null;
    }
    return await this.userManager.getUser();
  }
}
