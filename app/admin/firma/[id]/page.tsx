import CompanyDetailView from '../../../../components/admin/CompanyDetailView';

export default async function CompanyDetailPage(
  props: PageProps<'/admin/firma/[id]'>
) {
  const { id } = await props.params;

  return <CompanyDetailView companyId={id} />;
}
