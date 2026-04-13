import TenantAdminManager from '../../../../../components/admin/TenantAdminManager';

export default async function TenantEditPage(
  props: PageProps<'/admin/mieter/[id]/bearbeiten'>
) {
  const { id } = await props.params;

  return (
    <TenantAdminManager
      documentId={id}
      editMode
      hideOverview
      redirectPathAfterSave={`/admin/mieter/${id}`}
      submitLabel="Mieter speichern"
      title="Mieter bearbeiten"
    />
  );
}
