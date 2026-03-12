const SCOPES = [
  "openid",
  "profile",
  "email",
  "User.Read",
  "Calendars.Read",
].join(" ");

export function getOutlookConfig() {
  return {
    clientId: import.meta.env.VITE_MS_CLIENT_ID || "",
    tenantId: import.meta.env.VITE_MS_TENANT_ID || "common",
    redirectUri:
      import.meta.env.VITE_MS_REDIRECT_URI ||
      `${window.location.origin}/admin`,
    scopes: SCOPES,
  };
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(digest);
}

export async function beginOutlookAuth({ storageKeyPrefix }) {
  const { clientId, tenantId, redirectUri, scopes } = getOutlookConfig();
  if (!clientId) {
    throw new Error("Missing VITE_MS_CLIENT_ID.");
  }

  const verifier = randomString(96);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = `calendar-sync:${randomString(24)}`;

  sessionStorage.setItem(`${storageKeyPrefix}:verifier`, verifier);
  sessionStorage.setItem(`${storageKeyPrefix}:state`, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    prompt: "select_account",
  });

  window.location.assign(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`
  );
}

export async function completeOutlookAuth({ storageKeyPrefix, urlSearch }) {
  const { clientId, tenantId, redirectUri, scopes } = getOutlookConfig();
  const params = new URLSearchParams(urlSearch);
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem(`${storageKeyPrefix}:state`);
  const verifier = sessionStorage.getItem(`${storageKeyPrefix}:verifier`);

  if (!code || !state) return null;
  if (!expectedState || state !== expectedState) {
    throw new Error("Invalid Outlook OAuth state.");
  }
  if (!verifier) {
    throw new Error("Missing Outlook PKCE verifier.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: scopes,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || "Failed to complete Outlook sign-in.");
  }

  sessionStorage.removeItem(`${storageKeyPrefix}:state`);
  sessionStorage.removeItem(`${storageKeyPrefix}:verifier`);
  sessionStorage.setItem(`${storageKeyPrefix}:accessToken`, json.access_token);

  return json;
}

export function getStoredAccessToken(storageKeyPrefix) {
  return sessionStorage.getItem(`${storageKeyPrefix}:accessToken`) || "";
}

export function clearStoredAccessToken(storageKeyPrefix) {
  sessionStorage.removeItem(`${storageKeyPrefix}:accessToken`);
}

export async function fetchOutlookProfile(accessToken) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to load Outlook profile.");
  }

  return json;
}

export async function fetchOutlookEvents({
  accessToken,
  startDateTime,
  endDateTime,
}) {
  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    $select: "id,subject,start,end,showAs,categories,attendees",
    $orderby: "start/dateTime",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="Eastern Standard Time"',
      },
    }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to fetch Outlook events.");
  }

  return (json.value || []).map((event) => ({
    id: event.id,
    title: event.subject || "",
    subject: event.subject || "",
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    showAs: event.showAs || "",
    categories: Array.isArray(event.categories)
      ? event.categories.join(", ")
      : "",
    attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0,
  }));
}
