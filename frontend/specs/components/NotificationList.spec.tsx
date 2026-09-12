import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationList } from '@/components/notification-list/NotificationList';
import { lastRequest, mockList, mockResponse, notification, renderWithQuery } from '../helpers';

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

  describe('filter by user', () => {
    test('typing a user id refetches with ?userId= and describes the filtered view', async () => {
      const user = userEvent.setup();
      mockList([
        notification({ userId: 'user-42' }),
        notification({ id: '2'.padEnd(36, '0'), userId: 'other' }),
      ]);
      renderWithQuery(<NotificationList />);
      expect(await screen.findAllByTestId('notification-row')).toHaveLength(2);

      mockList([notification({ userId: 'user-42' })]);
      await user.type(screen.getByLabelText('Filter by user ID'), 'user-42');

      await waitFor(() => expect(lastRequest().url).toContain('userId=user-42'));
      await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(1));
      expect(screen.getByText(/Requests sent by user-42/)).toBeInTheDocument();
    });

    test("clicking a row's sender applies the filter, and × clears it", async () => {
      const user = userEvent.setup();
      mockList([notification({ userId: 'user-42' })]);
      renderWithQuery(<NotificationList />);
      await screen.findAllByTestId('notification-row');

      mockList([notification({ userId: 'user-42' })]);
      await user.click(screen.getByRole('button', { name: 'user-42' }));
      expect(screen.getByLabelText('Filter by user ID')).toHaveValue('user-42');
      await waitFor(() => expect(lastRequest().url).toContain('userId=user-42'));

      mockList([notification({ userId: 'user-42' })]);
      await user.click(screen.getByRole('button', { name: 'Clear filter' }));
      expect(screen.getByLabelText('Filter by user ID')).toHaveValue('');
      await waitFor(() => expect(lastRequest().url).not.toContain('userId='));
    });

    test('an invalid id is rejected with the shared schema message and never sent', async () => {
      const user = userEvent.setup();
      mockList([notification()]);
      renderWithQuery(<NotificationList />);
      await screen.findAllByTestId('notification-row');
      const calls = (global.fetch as jest.Mock).mock.calls.length;

      await user.type(screen.getByLabelText('Filter by user ID'), 'has space');

      expect(await screen.findByRole('alert')).toHaveTextContent('User ID may only contain');
      expect(screen.getByLabelText('Filter by user ID')).toHaveAttribute('aria-invalid', 'true');
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls);
    });

    test('shows a filtered empty state', async () => {
      const user = userEvent.setup();
      mockList([notification()]);
      renderWithQuery(<NotificationList />);
      await screen.findAllByTestId('notification-row');

      mockList([]);
      await user.type(screen.getByLabelText('Filter by user ID'), 'nobody');
      await screen.findByText('No requests from nobody yet.');
    });
  });
});
