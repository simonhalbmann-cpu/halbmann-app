import AdminEmployeeSettings from '../../../../../components/admin/AdminEmployeeSettings';

export default async function AdminEmployeeDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const resolvedParams = await params;

  return <AdminEmployeeSettings selectedUidFromRoute={resolvedParams.uid} />;
}
