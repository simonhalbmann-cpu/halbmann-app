import AdminCollectionManager from '../../../../../components/admin/AdminCollectionManager';
import {
  companyFields,
  companyPreviewFields,
} from '../../../../../components/admin/companyConfig';

export default async function CompanyEditPage(
  props: PageProps<'/admin/firma/[id]/bearbeiten'>
) {
  const { id } = await props.params;

  return (
    <AdminCollectionManager
      collectionName="companies"
      description="Hier kannst du bestehende Firmendaten anpassen, ergänzen und vorbereitete Dokumentenfelder aktualisieren."
      documentId={id}
      editMode
      emptyState="Noch keine Firmen angelegt."
      fields={companyFields}
      hideOverview
      itemRouteBase="/admin/firma"
      previewFields={companyPreviewFields}
      recordLabel="Firma"
      redirectPathAfterSave={`/admin/firma/${id}`}
      submitLabel="Firma speichern"
      title="Firma bearbeiten"
    />
  );
}
