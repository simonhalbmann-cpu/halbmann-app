import TenantHandoverWorkspace from '../../../../../components/admin/TenantHandoverWorkspace';

export default async function TenantHandoverPage(
  props: PageProps<'/admin/mieter/[id]/uebergabe'>
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const initialKind = searchParams.art === 'moveOut' ? 'moveOut' : 'moveIn';

  return <TenantHandoverWorkspace initialKind={initialKind} tenantId={id} />;
}
