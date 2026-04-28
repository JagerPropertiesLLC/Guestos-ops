'use client';
import StubPage from '@/components/StubPage';

export default function BookingsCalendarPage() {
  return <StubPage
    title="Bookings Calendar"
    description="STR bookings, check-ins, check-outs, and cleaning windows across all units. Pulled from Hostaway."
    comingSoon={[
      'Multi-property timeline grid',
      'Today, this week, this month views',
      'Color-coded by platform (Airbnb, VRBO, Direct, Booking.com)',
      'Click a booking to see full reservation detail',
      'Drag to extend or move (where channel allows)'
    ]} />;
}
