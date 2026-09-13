import { act, screen, waitFor, within } from '@testing-library/react';
import { markRecent } from '@/lib/recent';
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
    expect(within(rows[0]!).getByText(/failed after 3 attempts/)).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('note')).toHaveTextContent('Provider timeout');
    expect(within(rows[1]!).getByText('+97699112233')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('SMS')).toBeInTheDocument();
  });

  test('shows a skeleton while loading, then the live indicator settles once everything is terminal', async () => {
    mockList([notification({ status: 'QUEUED' })]);
    renderWithQuery(<NotificationList />);
    expect(screen.getByRole('status', { name: 'Loading requests' })).toBeInTheDocument();

    await screen.findAllByTestId('notification-row');
    expect(screen.getByTestId('live-indicator')).toHaveTextContent('Live');
  });

  test('describes the outcome and duration on finished rows', async () => {
    mockList([
      notification({
        id: '1'.padEnd(36, '0'),
        status: 'SENT',
        attempts: 1,
        createdAt: '2026-09-12T04:00:00.000Z',
        completedAt: '2026-09-12T04:00:01.400Z',
      }),
      notification({
        id: '2'.padEnd(36, '0'),
        status: 'FAILED',
        attempts: 3,
        createdAt: '2026-09-12T04:00:00.000Z',
        completedAt: '2026-09-12T04:02:05.000Z',
      }),
    ]);
    renderWithQuery(<NotificationList />);
    const rows = await screen.findAllByTestId('notification-row');
    expect(within(rows[0]!).getByText('sent in 1.4 s')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('failed after 3 attempts · 2 m 05 s')).toBeInTheDocument();
    expect(screen.getByTestId('live-indicator')).toHaveTextContent('Up to date');
  });

  test('highlights the request that was just created', async () => {
    const created = notification({ id: 'c'.padEnd(36, '0') });
    mockList([created]);
    renderWithQuery(<NotificationList />);
    await screen.findAllByTestId('notification-row');

    act(() => markRecent(created.id));
    expect(screen.getByTestId('notification-row')).toHaveAttribute('data-recent', 'true');
  });

  test('shows the error state when the list cannot be loaded', async () => {
    mockResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'r' } });
    renderWithQuery(<NotificationList />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Could not load requests: boom'),
    );
  });

  test('pages with "Load more" and shows where the reader is', async () => {
    const user = userEvent.setup();
    mockList([notification({ id: 'a'.padEnd(36, '0'), status: 'SENT' })], 'next');
    renderWithQuery(<NotificationList />);

    const button = await screen.findByRole('button', { name: 'Load more' });
    expect(screen.getByTestId('list-footer')).toHaveTextContent('Showing 1 request · more available');
    expect(lastRequest().url).toContain('limit=10');

    mockList([notification({ id: 'b'.padEnd(36, '0'), status: 'SENT' })], null);
    await user.click(button);

    await waitFor(() => expect(screen.getAllByTestId('notification-row')).toHaveLength(2));
    expect(lastRequest().url).toContain('cursor=next');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByTestId('list-footer')).toHaveTextContent('Showing all 2 requests');
  });

  test('no footer while the list is empty', async () => {
    mockList([]);
    renderWithQuery(<NotificationList />);
    await screen.findByText(/No requests yet/);
    expect(screen.queryByTestId('list-footer')).not.toBeInTheDocument();
  });
});
