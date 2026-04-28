'use client';
import StubPage from '@/components/StubPage';

export default function SettingsPage() {
  return <StubPage
    title="Settings"
    description="Users, permissions, entities, automations, and system config."
    comingSoon={[
      'User management (you, Dad, Wendy, Sam, vendors, tenants)',
      'Permission toggles per user',
      'Entity / LLC management',
      'Automations on/off (SWPPP report, COI renewal, etc.)',
      'API integrations (Hostaway, Stripe, Plaid)'
    ]} />;
}
