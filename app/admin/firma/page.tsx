import AdminCollectionManager from '../../../components/admin/AdminCollectionManager';
import {
  companyFields,
  companyPreviewFields,
} from '../../../components/admin/companyConfig';

export default function FirmaPage() {
  return (
    <AdminCollectionManager
      collectionName="companies"
      description="Firmen werden hier mit Rechtsform, Kontaktdaten, steuerlichen Angaben, E-Mail-Zugängen und vorbereiteten Dokumentenfeldern erfasst. Eigentümer-Zuordnungen erfolgen später in der Immobilie."
      emptyState="Noch keine Firmen angelegt."
      fields={companyFields}
      itemRouteBase="/admin/firma"
      overviewFirst
      overviewLabel="Firmen"
      overviewTitleFields={['name']}
      overviewVariant="compact"
      previewFields={companyPreviewFields}
      recordLabel="Firma"
      submitLabel="Firma anlegen"
      title="Firma"
    />
  );
}
