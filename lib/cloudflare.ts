// Cloudflare API client for managing the platform allow-list.
//
// The allow-list is stored in a single Access Group identified by
// CF_ACCESS_GROUP_ID. Emails are kept as individual `email` includes on the
// group. Any non-email includes on the group (e.g. domain rules, identity
// provider rules) are preserved on write.

const CF_API = "https://api.cloudflare.com/client/v4";

type AccessGroupInclude = {
  email?: { email: string };
  email_domain?: { domain: string };
  // Other CF rule types (identity provider, etc.) are passed through opaquely.
  [k: string]: unknown;
};

type AccessGroup = {
  id: string;
  name: string;
  include: AccessGroupInclude[];
  exclude?: AccessGroupInclude[];
  require?: AccessGroupInclude[];
};

function env() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;
  const groupId = process.env.CF_ACCESS_GROUP_ID;
  if (!token || !accountId || !groupId) {
    throw new Error(
      "Cloudflare env vars missing (CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID / CF_ACCESS_GROUP_ID).",
    );
  }
  return { token, accountId, groupId };
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = env();
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    success?: boolean;
    result?: T;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || !json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare API: ${msg}`);
  }
  return json.result as T;
}

async function getGroup(): Promise<AccessGroup> {
  const { accountId, groupId } = env();
  return cf<AccessGroup>(`/accounts/${accountId}/access/groups/${groupId}`);
}

async function putGroup(group: AccessGroup): Promise<void> {
  const { accountId, groupId } = env();
  await cf<AccessGroup>(`/accounts/${accountId}/access/groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: group.name,
      include: group.include,
      exclude: group.exclude ?? [],
      require: group.require ?? [],
    }),
  });
}

export async function getAllowedEmails(): Promise<string[]> {
  const g = await getGroup();
  return g.include
    .filter((i) => i.email?.email)
    .map((i) => i.email!.email.toLowerCase())
    .sort();
}

export async function addEmail(email: string): Promise<void> {
  const norm = email.trim().toLowerCase();
  if (!norm.includes("@")) throw new Error("Invalid email");
  const g = await getGroup();
  const already = g.include.some((i) => i.email?.email?.toLowerCase() === norm);
  if (already) return;
  g.include.push({ email: { email: norm } });
  await putGroup(g);
}

export async function removeEmail(email: string): Promise<void> {
  const norm = email.trim().toLowerCase();
  const g = await getGroup();
  const next = g.include.filter((i) => i.email?.email?.toLowerCase() !== norm);
  if (next.length === g.include.length) return; // nothing to do
  g.include = next;
  await putGroup(g);
}
