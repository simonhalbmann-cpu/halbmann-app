import TenantDetailView from '../../../../components/admin/TenantDetailView';

export default async function TenantDetailPage(
  props: PageProps<'/admin/mieter/[id]'>
) {
  const { id } = await props.params;

  return <TenantDetailView tenantId={id} />;
}
