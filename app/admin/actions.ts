"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/cf-access";
import { addEmail, removeEmail } from "@/lib/cloudflare";
import {
  addCloser,
  removeCloser,
  setCloserFlag,
  type CloserFlag,
} from "@/lib/closers";

// ---- Cloudflare Access allow-list ----

export async function addUserAction(email: string): Promise<void> {
  await requireAdmin();
  await addEmail(email);
  revalidatePath("/admin");
}

export async function removeUserAction(email: string): Promise<void> {
  await requireAdmin();
  await removeEmail(email);
  revalidatePath("/admin");
}

// ---- Closer roster ----

export async function addCloserAction(email: string): Promise<void> {
  await requireAdmin();
  await addCloser(email);
  revalidatePath("/admin");
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
  revalidatePath("/apps/calendar");
}

export async function removeCloserAction(email: string): Promise<void> {
  await requireAdmin();
  await removeCloser(email);
  revalidatePath("/admin");
  revalidatePath("/apps/calendar");
}
