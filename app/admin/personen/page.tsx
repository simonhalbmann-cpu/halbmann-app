import AdminCollectionManager from '../../../components/admin/AdminCollectionManager';
import {
  personFields,
  personPreviewFields,
} from '../../../components/admin/personConfig';

export default function PersonenPage() {
  return (
    <AdminCollectionManager
      collectionName="people"
      description="Hier werden externe Partner, Handwerker, Dienstleister, Steuerberater, Hausmeister und Verwalter als Kontakte gepflegt. Mieter liegen separat im Bereich Mieter."
      emptyState="Noch keine Dritten oder Dienstleister angelegt."
      fields={personFields}
      itemRouteBase="/admin/personen"
      overviewTitleFields={['lastName', 'firstName']}
      overviewSubtitleFields={['category', 'partnerCompanyName', 'propertyName']}
      overviewFirst
      overviewVariant="compact"
      previewFields={personPreviewFields}
      recordLabel="Kontakt"
      submitLabel="Person anlegen"
      title="Dritte & Dienstleister"
    />
  );
}
