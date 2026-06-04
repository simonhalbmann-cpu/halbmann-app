import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import {
  createAuthUserWithRest,
  deleteAuthUserWithRest,
  signInAuthUserWithRest,
} from '../../../../lib/firebaseAuthRest';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  deleteFirestoreDocument,
  listFirestoreCollection,
  setFirestoreDocument,
} from '../../../../lib/firestoreRest';
import {
  getDefaultAdminLevel,
  normalizeAdminPermissions,
  type AdminLevel,
  type AdminPermissions,
} from '../../../../lib/adminPermissions';

export const runtime = 'nodejs';

type EmployeePayload = {
  active?: boolean;
  adminLevel?: AdminLevel;
  adminPermissions?: AdminPermissions;
  contactEmail?: string;
  displayName?: string;
  email?: string;
  mobilePhone?: string;
  password?: string;
  phone?: string;
  uid?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeLocalUidFromToken(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      sub?: string;
      user_id?: string;
    };
    return cleanText(payload.user_id || payload.sub);
  } catch {
    return '';
  }
}

async function requireAdmin(request: Request) {
  const useAdmin = hasFirebaseAdminConfig();
  if (!useAdmin && process.env.NODE_ENV !== 'production') {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      return {
        error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
        token: '',
        uid: '',
        useAdmin,
      };
    }

    return { error: null, token, uid: decodeLocalUidFromToken(token), useAdmin };
  }

  if (!useAdmin) {
    return {
      error: NextResponse.json({ ok: false, error: 'firebase_admin_not_configured' }, { status: 500 }),
      token: '',
      uid: '',
      useAdmin,
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      token: '',
      uid: '',
      useAdmin,
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
        uid: '',
      };
    }

    return { error: null, token, uid: decoded.uid, useAdmin };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      token: '',
      uid: '',
      useAdmin,
    };
  }
}

async function employeeFromProfile(
  uid: string,
  data: FirebaseFirestore.DocumentData | Record<string, unknown>,
  useAdmin = true
) {
  let authUser: Awaited<ReturnType<ReturnType<typeof getAdminAuth>['getUser']>> | null = null;
  if (useAdmin) {
    try {
      authUser = await getAdminAuth().getUser(uid);
    } catch {
      authUser = null;
    }
  }

  const adminLevel = getDefaultAdminLevel(data.adminLevel, 'super_admin');

  return {
    active: data.active !== false && authUser?.disabled !== true,
    adminLevel,
    adminPermissions: normalizeAdminPermissions(
      data.adminPermissions,
      adminLevel === 'super_admin'
    ),
    authEmail: cleanText(data.authEmail || authUser?.email),
    contactEmail: cleanText(data.contactEmail),
    displayName: cleanText(data.displayName || authUser?.displayName),
    email: cleanText(data.email || authUser?.email),
    mobilePhone: cleanText(data.mobilePhone),
    phone: cleanText(data.phone),
    uid,
  };
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const employees = adminCheck.useAdmin
    ? await Promise.all(
        (
          await getAdminDb()
            .collection('userProfiles')
            .where('role', '==', 'admin')
            .get()
        ).docs.map((entry) => employeeFromProfile(entry.id, entry.data(), true))
      )
    : (
        await listFirestoreCollection('userProfiles', adminCheck.token)
      )
        .filter((entry) => entry.data.role === 'admin')
        .map((entry) => employeeFromProfile(entry.id, entry.data, false));

  const resolvedEmployees = await Promise.all(employees);

  resolvedEmployees.sort((left, right) =>
    (left.displayName || left.email).localeCompare(right.displayName || right.email, 'de')
  );

  return NextResponse.json({ employees: resolvedEmployees, ok: true });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const payload = (await request.json()) as EmployeePayload;
    const uid = cleanText(payload.uid);
    const email = cleanText(payload.email);
    const displayName = cleanText(payload.displayName);
    const password = cleanText(payload.password);
    const active = payload.active !== false;
    const adminLevel = getDefaultAdminLevel(payload.adminLevel);
    const adminPermissions = normalizeAdminPermissions(
      payload.adminPermissions,
      adminLevel === 'super_admin'
    );

    if (!email) {
      return NextResponse.json({ ok: false, error: 'email_required' }, { status: 400 });
    }
    if (!uid && password.length < 8) {
      return NextResponse.json({ ok: false, error: 'password_required' }, { status: 400 });
    }

    let nextUid = uid;

    if (adminCheck.useAdmin) {
      const auth = getAdminAuth();
      const db = getAdminDb();

      if (nextUid) {
        await auth.updateUser(nextUid, {
          disabled: !active,
          displayName: displayName || undefined,
          email,
          ...(password ? { password } : {}),
        });
      } else {
        try {
          const createdUser = await auth.createUser({
            disabled: !active,
            displayName: displayName || undefined,
            email,
            password,
          });
          nextUid = createdUser.uid;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('email-already-exists')) throw error;
          const existingUser = await auth.getUserByEmail(email);
          await auth.updateUser(existingUser.uid, {
            disabled: !active,
            displayName: displayName || undefined,
            ...(password ? { password } : {}),
          });
          nextUid = existingUser.uid;
        }
      }

      await db.collection('userProfiles').doc(nextUid).set(
        {
          active,
          adminLevel,
          adminPermissions,
          authEmail: email,
          contactEmail: cleanText(payload.contactEmail),
          displayName,
          email,
          mobilePhone: cleanText(payload.mobilePhone),
          phone: cleanText(payload.phone),
          role: 'admin',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
          ...(uid ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: adminCheck.uid }),
        },
        { merge: true }
      );

      const profile = await db.collection('userProfiles').doc(nextUid).get();
      return NextResponse.json({
        employee: await employeeFromProfile(nextUid, profile.data() ?? {}, true),
        ok: true,
      });
    }

    if (!nextUid) {
      try {
        const createdUser = await createAuthUserWithRest(email, password);
        nextUid = createdUser.uid;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('EMAIL_EXISTS')) throw error;
        const existingUser = await signInAuthUserWithRest(email, password);
        nextUid = existingUser.uid;
      }
    } else if (password) {
      return NextResponse.json({ ok: false, error: 'local_password_change_not_supported' }, { status: 400 });
    }

    const profileData = {
      active,
      adminLevel,
      adminPermissions,
      authEmail: email,
      contactEmail: cleanText(payload.contactEmail),
      displayName,
      email,
      mobilePhone: cleanText(payload.mobilePhone),
      phone: cleanText(payload.phone),
      role: 'admin',
      updatedAt: new Date().toISOString(),
      updatedBy: adminCheck.uid,
      ...(uid ? {} : { createdAt: new Date().toISOString(), createdBy: adminCheck.uid }),
    };

    await setFirestoreDocument('userProfiles', nextUid, profileData, adminCheck.token);

    return NextResponse.json({
      employee: await employeeFromProfile(nextUid, profileData, false),
      ok: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'employee_save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const payload = (await request.json()) as EmployeePayload;
    const uid = cleanText(payload.uid);
    const email = cleanText(payload.email);
    const password = cleanText(payload.password);

    if (!uid && !email) {
      return NextResponse.json({ ok: false, error: 'employee_missing' }, { status: 400 });
    }
    if (uid && uid === adminCheck.uid) {
      return NextResponse.json({ ok: false, error: 'cannot_delete_self' }, { status: 400 });
    }

    if (adminCheck.useAdmin) {
      const auth = getAdminAuth();
      const db = getAdminDb();
      const resolvedUid = uid || (await auth.getUserByEmail(email)).uid;
      await auth.deleteUser(resolvedUid);
      await db.collection('userProfiles').doc(resolvedUid).delete();
      return NextResponse.json({ ok: true });
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: 'password_required_for_local_delete' }, { status: 400 });
    }

    const resolvedUid = uid || (await signInAuthUserWithRest(email, password)).uid;
    await deleteAuthUserWithRest(email, password);
    await deleteFirestoreDocument('userProfiles', resolvedUid, adminCheck.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'employee_delete_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
