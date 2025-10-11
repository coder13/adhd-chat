import { useState } from 'react';
import Button from './Button';
import Input from './Input';

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
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to ADHD Chat
          </h2>
          <p className="text-gray-600">
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
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

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            This app uses Single Sign-On (SSO) for secure authentication
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginCard;
