import TenantDetailView from '../../../../components/admin/TenantDetailView';

export default async function TenantDetailPage(
  props: PageProps<'/admin/mieter/[id]'>
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const selectedMessageId =
    typeof searchParams.messageId === 'string' ? searchParams.messageId : '';
  const selectedTab = searchParams.tab === 'archive' ? 'archive' : 'open';

  return (
    <TenantDetailView
      activeThemeListMode={selectedTab}
      detailLayout="messages"
      selectedMessageId={selectedMessageId}
      showEditButton={false}
      showOverviewButton={false}
      tenantId={id}
    />
  );
}
