"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  addCloser,
  removeCloser,
  setCloserFlag,
  type CloserFlag,
} from "@/lib/closers";
import {
  addAllowed,
  getAllowed,
  removeAllowed,
} from "@/lib/clerk-allowlist";

// ---- Site access (Clerk allowlist) ----

export async function addAllowedAction(
  email: string,
): Promise<{ id: string; identifier: string }> {
  await requireAdmin();
  await addAllowed(email, true);
  // Clerk's create-endpoint doesn't return the new row consistently; re-fetch.
  const list = await getAllowed();
  const created = list.find(
    (a) => a.identifier === email.trim().toLowerCase(),
  );
  if (!created) throw new Error("Created but could not re-fetch the entry");
  revalidatePath("/admin/access");
  return { id: created.id, identifier: created.identifier };
}

export async function removeAllowedAction(id: string): Promise<void> {
  await requireAdmin();
  await removeAllowed(id);
  revalidatePath("/admin/access");
}

export async function addCloserAction(email: string): Promise<void> {
  await requireAdmin();
  await addCloser(email);
  revalidatePath("/admin");
  revalidatePath("/admin/closers");
  revalidatePath("/apps/calendar");
}

export async function setCloserFlagAction(
  email: string,
  field: CloserFlag,
  value: boolean,
): Promise<void> {
  await requireAdmin();
  await setCloserFlag(email, field, value);
  revalidatePath("/admin");
  revalidatePath("/admin/closers");
  revalidatePath("/apps/calendar");
}

export async function removeCloserAction(email: string): Promise<void> {
  await requireAdmin();
  await removeCloser(email);
  revalidatePath("/admin");
  revalidatePath("/admin/closers");
  revalidatePath("/apps/calendar");
}
