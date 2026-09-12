import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationList } from '@/components/notification-list/NotificationList';
import { mockList, mockResponse, notification, renderWithQuery } from '../helpers';

describe('NotificationList', () => {
  test('shows loading, then the empty state', async () => {
    mockList([]);
    renderWithQuery(<NotificationList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await screen.findByText(/No requests yet/);
  });

  test('renders rows newest first with status, channel, attempts and lastError', async () => {
    mockList([
      notification({ id: '1'.padEnd(36, '0'), status: 'FAILED', attempts: 3, lastError: 'Provider timeout' }),
      notification({ id: '2'.padEnd(36, '0'), status: 'SENT', channel: 'SMS', recipient: '+97699112233' }),
    ]);
    renderWithQuery(<NotificationList />);

    const rows = await screen.findAllByTestId('notification-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole('status')).toHaveTextContent('Failed');
    expect(within(rows[0]!).getByText(/attempt 3/)).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('note')).toHaveTextContent('Provider timeout');
    expect(within(rows[1]!).getByText('+97699112233')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('SMS')).toBeInTheDocument();
  });

  test('shows the error state when the list cannot be loaded', async () => {
    mockResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'r' } });
    renderWithQuery(<NotificationList />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Could not load requests: boom'),
    );
  });

  test('offers "Load more" only while a next cursor exists', async () => {
    const user = userEvent.setup();
    mockList([notification({ id: 'a'.padEnd(36, '0'), status: 'SENT' })], 'next');
    renderWithQuery(<NotificationList />);

    const button = await screen.findByRole('button', { name: 'Load more' });
    mockList([notification({ id: 'b'.padEnd(36, '0'), status: 'SENT' })], null);
    await user.click(button);

    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
