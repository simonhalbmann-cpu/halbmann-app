import PropertyDetailView from '../../../../components/admin/PropertyDetailView';

export default async function PropertyDetailPage(
  props: PageProps<'/admin/immobilie/[id]'>
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const selectedUnitId =
    typeof searchParams.unit === 'string' ? searchParams.unit : undefined;

  return <PropertyDetailView propertyId={id} selectedUnitId={selectedUnitId} />;
}
