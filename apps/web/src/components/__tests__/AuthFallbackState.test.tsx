/// <reference types="jest" />

import { render, screen } from '@testing-library/react';
import AuthFallbackState from '../AuthFallbackState';

describe('AuthFallbackState', () => {
  it('shows a restoring shell while auth is syncing', () => {
    render(
      <AuthFallbackState
        state="syncing"
        signedOutMessage={
          <>
            Please <a href="/login">log in</a>.
          </>
        }
      />
    );

    expect(screen.getByText('Restoring your session')).toBeTruthy();
    expect(
      screen.getByText(/Reconnecting to your Tandem space/i)
    ).toBeTruthy();
    expect(screen.queryByText(/log in/i)).toBeNull();
  });

  it('shows signed-out content once auth is logged out', () => {
    render(
      <AuthFallbackState
        state="logged_out"
        signedOutTitle="ADHD Chat"
        signedOutMessage={
          <>
            Please <a href="/login">log in</a>.
          </>
        }
      />
    );

    expect(screen.getByText('ADHD Chat')).toBeTruthy();
    expect(screen.getByText(/log in/i)).toBeTruthy();
  });
});
