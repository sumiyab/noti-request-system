import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationList } from '@/components/notification-list/NotificationList';
import { lastRequest, mockList, notification, renderWithQuery } from '../helpers';

describe('NotificationList — filter by user', () => {
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
    expect(screen.getByText(/Sent by user-42/)).toBeInTheDocument();
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
    await screen.findByText('No requests from nobody yet');
  });
});
