import PropertyServiceProvidersView from '../../../../../components/admin/PropertyServiceProvidersView';

export default async function PropertyServiceProvidersPage(
  props: PageProps<'/admin/immobilie/[id]/dienstleister'>
) {
  const { id } = await props.params;

  return <PropertyServiceProvidersView propertyId={id} />;
}
