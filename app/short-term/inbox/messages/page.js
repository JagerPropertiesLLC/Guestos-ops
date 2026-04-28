'use client';
import StubPage from '@/components/StubPage';

export default function GuestMessagesPage() {
  return <StubPage
    title="Guest Messages"
    description="Live conversations from Hostaway / Quo. When GuestOS replies on your behalf, the message is marked read here automatically so your inbox stays clean."
    comingSoon={[
      'All conversations across STR units',
      'Filter by property or platform (Airbnb, VRBO, Direct, Booking)',
      'Auto-read sync with Approval Queue',
      'Quick reply / hand off to GuestOS',
      'Unread badge on the rail icon'
    ]} />;
}
