import PersonDetailView from '../../../../components/admin/PersonDetailView';

export default async function PersonDetailPage(
  props: PageProps<'/admin/personen/[id]'>
) {
  const { id } = await props.params;

  return <PersonDetailView personId={id} />;
}
