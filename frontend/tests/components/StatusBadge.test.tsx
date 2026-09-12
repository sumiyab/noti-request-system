import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/notification-list/StatusBadge';

test.each([
  ['PENDING', 'Pending'],
  ['QUEUED', 'Queued'],
  ['PROCESSING', 'Processing'],
  ['SENT', 'Sent'],
  ['FAILED', 'Failed'],
] as const)('%s renders as a live status "%s"', (status, label) => {
  render(<StatusBadge status={status} />);
  const badge = screen.getByRole('status');
  expect(badge).toHaveTextContent(label);
  expect(badge).toHaveAttribute('data-status', status);
});
