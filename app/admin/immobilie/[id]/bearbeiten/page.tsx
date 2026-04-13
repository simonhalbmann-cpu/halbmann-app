import PropertyAdminManager from '../../../../../components/admin/PropertyAdminManager';

export default async function PropertyEditPage(
  props: PageProps<'/admin/immobilie/[id]/bearbeiten'>
) {
  const { id } = await props.params;

  return (
    <PropertyAdminManager
      documentId={id}
      editMode
      hideOverview
      redirectPathAfterSave={`/admin/immobilie/${id}`}
      submitLabel="Immobilie speichern"
      title="Immobilie bearbeiten"
    />
  );
}
