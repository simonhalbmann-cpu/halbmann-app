import PropertyDetailView from '../../../../../components/admin/PropertyDetailView';

export default async function PropertyDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const selectedUnitId =
    typeof searchParams.unit === 'string' ? searchParams.unit : undefined;

  return <PropertyDetailView propertyId={id} selectedUnitId={selectedUnitId} />;
}
