import { NotificationForm } from '@/components/notification-form/NotificationForm';
import { NotificationList } from '@/components/notification-list/NotificationList';
import { ThemeToggle } from '@/components/ThemeToggle';

const Page = () => (
  <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification requests</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submit a request and watch it move through the queue. Delivery is simulated.
        </p>
      </div>
      <ThemeToggle />
    </header>
    {/* items-start: the form keeps its own height instead of stretching to match a long list; on wide
        screens it also stays in view while the list scrolls. */}
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-8">
        <NotificationForm />
      </div>
      <NotificationList />
    </div>
  </main>
);

export default Page;
