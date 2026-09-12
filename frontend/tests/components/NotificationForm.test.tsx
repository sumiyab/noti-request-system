import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationForm } from '@/components/notification-form/NotificationForm';
import { lastRequest, mockList, mockResponse, notification, renderWithQuery } from '../helpers';

const fill = async (user: ReturnType<typeof userEvent.setup>, values: Record<string, string>) => {
  for (const [label, value] of Object.entries(values)) {
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), value);
  }
};

describe('NotificationForm', () => {
  test('validates with the shared schema before submitting', async () => {
    const user = userEvent.setup();
    renderWithQuery(<NotificationForm />);

    await fill(user, { 'Email address': 'jane@', Subject: 'Hi', Message: 'Hello' });
    await user.click(screen.getByRole('button', { name: 'Send notification' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('switching to SMS removes the subject field and omits it from the request', async () => {
    const user = userEvent.setup();
    mockResponse(202, {
      data: notification({ channel: 'SMS', recipient: '+97699112233', subject: undefined }),
    });
    mockList([]);
    renderWithQuery(<NotificationForm />);

    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'SMS' }));
    expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();

    await fill(user, { 'Phone number': '+97699112233', Message: 'Hello' });
    await user.click(screen.getByRole('button', { name: 'Send notification' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(lastRequest().init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ channel: 'SMS', recipient: '+97699112233', message: 'Hello' });
  });

  test('maps a server VALIDATION_ERROR onto the right field', async () => {
    const user = userEvent.setup();
    mockResponse(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: 'subject', message: 'Subject rejected by server' }],
        requestId: 'r',
      },
    });
    renderWithQuery(<NotificationForm />);

    await fill(user, { 'Email address': 'jane@example.com', Subject: 'Hi', Message: 'Hello' });
    await user.click(screen.getByRole('button', { name: 'Send notification' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Subject rejected by server');
    expect(screen.getByLabelText('Subject')).toHaveAttribute('aria-invalid', 'true');
  });

  test('resets the fields after a successful submit', async () => {
    const user = userEvent.setup();
    mockResponse(202, { data: notification() });
    mockList([notification()]);
    renderWithQuery(<NotificationForm />);

    await fill(user, { 'Email address': 'jane@example.com', Subject: 'Welcome!', Message: 'Thanks' });
    await user.click(screen.getByRole('button', { name: 'Send notification' }));

    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue(''));
    expect(screen.getByLabelText('Message')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send notification' })).toBeEnabled();
  });
});
