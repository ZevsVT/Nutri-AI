export interface PasswordResetEmailProvider {
  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

/**
 * Delivery is intentionally a no-op until a real mail provider is configured.
 * The reset secret is accepted by the provider boundary but is never logged or
 * returned by the HTTP API.
 */
export class NoopPasswordResetEmailProvider implements PasswordResetEmailProvider {
  async sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    void input;
    return;
  }
}
