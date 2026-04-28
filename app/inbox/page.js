'use client';
import StubPage from '@/components/StubPage';

export default function InboxPage() {
  return <StubPage
    title="Inbox"
    description="Unified inbox: guest messages, tenant messages, vendor communications, system alerts."
    comingSoon={[
      'GuestOS approvals queue',
      'Tenant maintenance requests',
      'Vendor messages',
      'System reminders firing'
    ]} />;
}
