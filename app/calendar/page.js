'use client';
import StubPage from '@/components/StubPage';

export default function CalendarPage() {
  return <StubPage
    title="Calendar"
    description="Unified calendar across reservations, leases, inspections, payments, and vendor visits."
    comingSoon={[
      'Reservations from Hostaway',
      'Lease starts and ends',
      'Inspection schedule',
      'Property tax due dates',
      'Insurance expirations',
      'Vendor scheduled visits'
    ]} />;
}
