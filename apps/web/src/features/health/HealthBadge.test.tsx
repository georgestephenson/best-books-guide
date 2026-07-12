import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBadge } from './HealthBadge.js';

describe('HealthBadge', () => {
  it('shows a loading message while checking', () => {
    render(<HealthBadge state="loading" />);
    expect(screen.getByText(/checking api/i)).toBeInTheDocument();
  });

  it('shows an error message when unreachable', () => {
    render(<HealthBadge state="error" />);
    expect(screen.getByText(/api unreachable/i)).toBeInTheDocument();
  });

  it('falls back to the error message if ready but health is missing', () => {
    render(<HealthBadge state="ready" />);
    expect(screen.getByText(/api unreachable/i)).toBeInTheDocument();
  });

  it('renders status, version and uptime when ready', () => {
    render(
      <HealthBadge state="ready" health={{ status: 'ok', version: 'abc123', uptimeSeconds: 12 }} />,
    );
    expect(screen.getByText(/api ok · abc123 · up 12s/i)).toBeInTheDocument();
  });
});
