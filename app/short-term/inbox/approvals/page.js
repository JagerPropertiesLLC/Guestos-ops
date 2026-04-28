'use client';
import StubPage from '@/components/StubPage';

export default function ApprovalQueuePage() {
  return <StubPage
    title="Approval Queue"
    description="GuestOS-drafted replies waiting for your approval. Approve to send (and the original guest message is marked read in Guest Messages)."
    comingSoon={[
      'Side-by-side: original guest message + drafted reply',
      'Approve / Edit / Reject / Send manually',
      'Auto-approve thresholds for low-risk replies',
      'Bulk approve safe categories',
      'Sync mark-as-read on send'
    ]} />;
}
