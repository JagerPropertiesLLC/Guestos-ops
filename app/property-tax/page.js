'use client';
import StubPage from '@/components/StubPage';

export default function PropertyTaxPage() {
  return <StubPage
    title="Property Tax"
    description="Annual property tax records across the portfolio. Reminders fire 60 days before due dates."
    comingSoon={['Per-property tax history', 'Upcoming due dates', 'Assessment changes year-over-year', 'Auto-reminder before payment due']} />;
}
