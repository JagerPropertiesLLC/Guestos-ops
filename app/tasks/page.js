'use client';
import StubPage from '@/components/StubPage';

export default function TasksPage() {
  return <StubPage
    title="Tasks"
    description="Things to do that aren't tied to a specific maintenance work order."
    comingSoon={['Personal task list', 'Assigned to staff (Sam, Wendy)', 'Recurring tasks', 'Linked to properties / projects']} />;
}
