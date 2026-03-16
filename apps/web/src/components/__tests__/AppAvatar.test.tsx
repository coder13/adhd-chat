/// <reference types="jest" />

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('@ionic/react', () => ({
  IonAvatar: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

import AppAvatar from '../AppAvatar';

describe('AppAvatar', () => {
  it('prefers a chosen icon over initials', () => {
    render(<AppAvatar name="Plans" icon="🧠" />);

    expect(screen.getByLabelText('Plans').textContent).toContain('🧠');
  });

  it('falls back to initials when no icon or avatar exists', () => {
    render(<AppAvatar name="Plans" />);

    expect(screen.getByText('P')).toBeTruthy();
  });
});
