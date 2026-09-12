import { NotificationForm } from '@/components/notification-form/NotificationForm';
import { NotificationList } from '@/components/notification-list/NotificationList';

const Page = () => (
  <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">Notification requests</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Submit a request and watch it move through the queue. Delivery is simulated.
      </p>
    </header>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <NotificationForm />
      <NotificationList />
    </div>
  </main>
);

export default Page;
