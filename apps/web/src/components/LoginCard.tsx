import { useState } from 'react';
import Button from './Button';
import Input from './Input';
import Card from './ui/Card';

interface LoginCardProps {
  onLogin: (homeserver: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

function LoginCard({ onLogin, isLoading = false, error }: LoginCardProps) {
  const [homeserver, setHomeserver] = useState('https://matrix.org');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (homeserver.trim()) {
      onLogin(homeserver.trim());
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
          <Input
            label="Homeserver URL"
            type="url"
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder="https://matrix.org"
            helperText="Enter your Matrix homeserver URL"
            disabled={isLoading}
            required
          />

          {error && (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={isLoading || !homeserver.trim()}
            size="lg"
          >
            {isLoading ? 'Connecting...' : 'Login with SSO'}
          </Button>
        </form>

        <div className="mt-6 border-t border-line pt-6">
          <p className="text-center text-xs text-text-subtle">
            This app uses Single Sign-On (SSO) for secure authentication
          </p>
        </div>
      </Card>
    </div>
  );
}

export default LoginCard;
