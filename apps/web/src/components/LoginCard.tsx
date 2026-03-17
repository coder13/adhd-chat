import { useState } from 'react';
import Button from './Button';
import Input from './Input';
import Card from './ui/Card';
import SegmentedControl from './ui/SegmentedControl';

interface LoginCardProps {
  onLoginWithSso: (homeserver: string) => void;
  onLoginWithPassword: (
    homeserver: string,
    username: string,
    password: string
  ) => void;
  isLoading?: boolean;
  error?: string | null;
}

type LoginMode = 'sso' | 'password';

function LoginCard({
  onLoginWithSso,
  onLoginWithPassword,
  isLoading = false,
  error,
}: LoginCardProps) {
  const [mode, setMode] = useState<LoginMode>('sso');
  const [homeserver, setHomeserver] = useState('https://matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHomeserver = homeserver.trim();

    if (!trimmedHomeserver) {
      return;
    }

    if (mode === 'sso') {
      onLoginWithSso(trimmedHomeserver);
      return;
    }

    if (username.trim() && password) {
      onLoginWithPassword(trimmedHomeserver, username.trim(), password);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="p-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-text mb-2">
            Welcome to ADHD Chat
          </h2>
          <p className="text-text-muted">
            Connect to your Matrix homeserver to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'sso', label: 'SSO' },
              { value: 'password', label: 'Password' },
            ]}
          />

          <Input
            label="Homeserver URL"
            type="url"
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder="https://matrix.org"
            helperText="Enter your Matrix homeserver URL"
            name="homeserver"
            data-testid="homeserver-input"
            disabled={isLoading}
            required
          />

          {mode === 'password' && (
            <>
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@you:example.org or local username"
                helperText="Use your Matrix ID or the local username your homeserver accepts."
                name="username"
                data-testid="username-input"
                autoComplete="username"
                disabled={isLoading}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                name="password"
                data-testid="password-input"
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
            </>
          )}

          {error && (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            data-testid={mode === 'sso' ? 'sso-login-button' : 'password-login-button'}
            disabled={
              isLoading ||
              !homeserver.trim() ||
              (mode === 'password' && (!username.trim() || !password))
            }
            size="lg"
          >
            {isLoading
              ? 'Connecting...'
              : mode === 'sso'
                ? 'Login with SSO'
                : 'Login with Password'}
          </Button>
        </form>

        <div className="mt-6 border-t border-line pt-6">
          <p className="text-center text-xs text-text-subtle">
            {mode === 'sso'
              ? "Use your homeserver's browser-based Single Sign-On flow."
              : 'Use a password-capable homeserver account such as a local Synapse test user.'}
          </p>
        </div>
      </Card>
    </div>
  );
}

export default LoginCard;
