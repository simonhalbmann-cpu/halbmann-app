import MessageDetailWorkspace from '../../../../components/admin/MessageDetailWorkspace';

export default async function NachrichtDetailPage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const { messageId } = await params;

  return <MessageDetailWorkspace messageId={messageId} />;
}
