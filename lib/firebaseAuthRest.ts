type FirebaseAuthResponse = {
  email?: string;
  idToken?: string;
  localId?: string;
};

function getApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY fehlt.');
  }
  return apiKey;
}

async function callAuth(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${getApiKey()}`,
    {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  );

  const result = (await response.json()) as FirebaseAuthResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(result.error?.message || `firebase_auth_rest_${endpoint}_failed`);
  }

  return result;
}

export async function createAuthUserWithRest(email: string, password: string) {
  const result = await callAuth('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  return {
    email: result.email || email,
    uid: result.localId || '',
  };
}

export async function updateAuthUserWithRest(args: {
  currentEmail: string;
  currentPassword: string;
  nextEmail: string;
  nextPassword?: string;
}) {
  const signIn = await callAuth('accounts:signInWithPassword', {
    email: args.currentEmail,
    password: args.currentPassword,
    returnSecureToken: true,
  });

  const result = await callAuth('accounts:update', {
    email: args.nextEmail,
    idToken: signIn.idToken,
    password: args.nextPassword || args.currentPassword,
    returnSecureToken: true,
  });

  return {
    email: result.email || args.nextEmail,
    uid: result.localId || '',
  };
}
