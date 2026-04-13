import MeterDetailView from '../../../../../components/admin/MeterDetailView';

export default async function MeterDetailPage(
  props: PageProps<'/admin/zaehler/[propertyId]/[meterId]'>
) {
  const { meterId, propertyId } = await props.params;
  const searchParams = await props.searchParams;
  const unitId = typeof searchParams.unit === 'string' ? searchParams.unit : undefined;

  return <MeterDetailView meterId={meterId} propertyId={propertyId} unitId={unitId} />;
}
