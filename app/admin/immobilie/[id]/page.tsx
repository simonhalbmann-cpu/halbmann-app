import PropertyOverviewView from '../../../../components/admin/PropertyOverviewView';

export default async function PropertyOverviewPage(
  props: PageProps<'/admin/immobilie/[id]'>
) {
  const { id } = await props.params;

  return <PropertyOverviewView propertyId={id} />;
}
