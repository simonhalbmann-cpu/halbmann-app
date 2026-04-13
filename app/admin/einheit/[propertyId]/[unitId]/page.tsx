import UnitDetailView from '../../../../../components/admin/UnitDetailView';

export default async function UnitDetailPage(
  props: PageProps<'/admin/einheit/[propertyId]/[unitId]'>
) {
  const { propertyId, unitId } = await props.params;

  return <UnitDetailView propertyId={propertyId} unitId={unitId} />;
}
