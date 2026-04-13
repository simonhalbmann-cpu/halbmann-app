import TicketDetailWorkspace from '../../../../components/admin/TicketDetailWorkspace';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const resolvedParams = await params;
  return <TicketDetailWorkspace ticketId={resolvedParams.ticketId} />;
}
