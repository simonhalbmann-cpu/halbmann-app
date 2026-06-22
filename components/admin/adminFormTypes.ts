export type FieldOption = {
  label: string;
  value: string;
};

export type RelationConfig = {
  collectionName: string;
  emptyLabel?: string;
  labelFields: string[];
  storeLabelAs?: string;
};

export type AdminField = {
  accept?: string;
  autoComplete?: string;
  kind?:
    | 'address_city'
    | 'address_country'
    | 'address_house_number'
    | 'address_postal_code'
    | 'address_street'
    | 'credential_email'
    | 'credential_password';
  helpText?: string;
  label: string;
  name: string;
  options?: FieldOption[];
  placeholder?: string;
  relation?: RelationConfig;
  required?: boolean;
  rows?: number;
  sectionItems?: string[];
  sectionText?: string;
  type?:
    | 'date'
    | 'email'
    | 'contact-list'
    | 'file'
    | 'image'
    | 'number'
    | 'password'
    | 'relation'
    | 'relation-list'
    | 'relation-multi'
    | 'section'
    | 'select'
    | 'tel'
    | 'text'
    | 'text-list'
    | 'textarea';
};

export type PreviewField = {
  label: string;
  name: string;
};

export type AdminDocumentField = {
  label: string;
  name: string;
};

export type OverviewVariant = 'compact' | 'detail';
