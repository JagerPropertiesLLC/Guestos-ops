'use client';
import StubPage from '@/components/StubPage';

export default function MaintenancePage() {
  return <StubPage
    title="Maintenance"
    description="All work orders across the portfolio. Filter by property type, priority, or status."
    comingSoon={['Open work orders', 'Tenant-submitted requests', 'Auto-routing to vendors', 'Cost tracking per property']} />;
}
