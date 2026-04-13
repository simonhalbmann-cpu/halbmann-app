import AdminCollectionManager from '../../../../../components/admin/AdminCollectionManager';
import {
  personFields,
  personPreviewFields,
} from '../../../../../components/admin/personConfig';

export default async function PersonEditPage(
  props: PageProps<'/admin/personen/[id]/bearbeiten'>
) {
  const { id } = await props.params;

  return (
    <AdminCollectionManager
      collectionName="people"
      description="Hier kannst du bestehende Kontakte, Dienstleister und externe Partner aktualisieren."
      documentId={id}
      editMode
      emptyState="Noch keine Dritten oder Dienstleister angelegt."
      fields={personFields}
      hideOverview
      itemRouteBase="/admin/personen"
      previewFields={personPreviewFields}
      recordLabel="Kontakt"
      redirectPathAfterSave={`/admin/personen/${id}`}
      submitLabel="Kontakt speichern"
      title="Kontakt bearbeiten"
    />
  );
}
