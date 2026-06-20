const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

type FirestoreValue = Record<string, unknown>;
type FirestoreFields = Record<string, FirestoreValue>;
type FirestoreDocument = {
  fields?: FirestoreFields;
  name?: string;
};
type FirestoreRunQueryEntry = {
  document?: FirestoreDocument;
};

function getBaseUrl() {
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID fehlt.');
  }

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function encodeValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => encodeValue(entry)),
      },
    };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  switch (typeof value) {
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    case 'string':
      return { stringValue: value };
    case 'object':
      return {
        mapValue: {
          fields: encodeFields(value as Record<string, unknown>),
        },
      };
    default:
      return { stringValue: String(value) };
  }
}

function encodeFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
  );
}

function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return value.integerValue;
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const mapValue = value.mapValue as { fields?: FirestoreFields } | undefined;
    return decodeFields(mapValue?.fields);
  }
  if ('arrayValue' in value) {
    const arrayValue = value.arrayValue as { values?: FirestoreValue[] } | undefined;
    const values = Array.isArray(arrayValue?.values) ? arrayValue.values : [];
    return values.map((entry) => decodeValue(entry));
  }
  return null;
}

function decodeFields(fields: FirestoreFields | undefined) {
  if (!fields) return {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
  );
}

function extractDocId(name: string | undefined) {
  const parts = (name ?? '').split('/');
  return parts[parts.length - 1] || '';
}

async function fireRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Firestore REST Fehler ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function addFirestoreDocument(
  collectionName: string,
  data: Record<string, unknown>,
  token: string
) {
  const result = await fireRequest<{ name?: string }>(
    `${getBaseUrl()}/${collectionName}`,
    token,
    {
      body: JSON.stringify({ fields: encodeFields(data) }),
      method: 'POST',
    }
  );

  return extractDocId(result.name);
}

export async function setFirestoreDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, unknown>,
  token: string
) {
  await fireRequest(
    `${getBaseUrl()}/${collectionName}/${documentId}`,
    token,
    {
      body: JSON.stringify({ fields: encodeFields(data) }),
      method: 'PATCH',
    }
  );
}

export async function deleteFirestoreDocument(
  collectionName: string,
  documentId: string,
  token: string
) {
  await fireRequest(
    `${getBaseUrl()}/${collectionName}/${documentId}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

export async function getFirestoreDocument(
  collectionName: string,
  documentId: string,
  token: string
) {
  const result = await fireRequest<FirestoreDocument>(
    `${getBaseUrl()}/${collectionName}/${documentId}`,
    token
  );

  return {
    data: decodeFields(result.fields),
    id: extractDocId(result.name),
  };
}

export async function queryFirestoreEquals(
  collectionName: string,
  field: string,
  value: string,
  token: string,
  limit = 1
) {
  const result = await fireRequest<FirestoreRunQueryEntry[]>(
    `${getBaseUrl()}:runQuery`,
    token,
    {
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          limit,
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
        },
      }),
      method: 'POST',
    }
  );

  return result
    .flatMap((entry) => {
      if (!entry.document) return [];
      return [{
        data: decodeFields(entry.document.fields),
        id: extractDocId(entry.document.name),
      }];
    });
}

export async function listFirestoreCollection(collectionName: string, token: string) {
  const result = await fireRequest<{ documents?: FirestoreDocument[] }>(
    `${getBaseUrl()}/${collectionName}`,
    token
  );

  return (result.documents ?? []).map((entry) => ({
    data: decodeFields(entry.fields),
    id: extractDocId(entry.name),
  }));
}
