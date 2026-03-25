'use client';

export interface SessionHint {
  tenantName?: string;
  tenantSlug: string;
  email: string;
  workspaceName?: string;
  workspaceSlug?: string;
}

const ACCESS_TOKEN_STORAGE_KEY = 'saaso.access_token';
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'access_token';
const SESSION_HINT_STORAGE_KEY = 'saaso.session';

function canUseBrowserStorage() {
  return typeof window !== 'undefined';
}

export function readAccessToken(): string | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const currentToken =
    window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ??
    window.sessionStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);

  if (currentToken) {
    return currentToken;
  }

  const legacyToken =
    window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);

  if (!legacyToken) {
    return null;
  }

  window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, legacyToken);
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);

  return legacyToken;
}

export function writeAccessToken(token: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
}

export function readSessionHint(fallback: SessionHint): SessionHint {
  if (!canUseBrowserStorage()) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(SESSION_HINT_STORAGE_KEY);
  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SessionHint>;
    return {
      tenantName: parsed.tenantName ?? fallback.tenantName,
      tenantSlug: parsed.tenantSlug ?? fallback.tenantSlug,
      email: parsed.email ?? fallback.email,
      workspaceName: parsed.workspaceName ?? fallback.workspaceName,
      workspaceSlug: parsed.workspaceSlug ?? fallback.workspaceSlug,
    };
  } catch {
    return fallback;
  }
}

export function writeSessionHint(hint: SessionHint) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, JSON.stringify(hint));
}
