"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/cf-access";
import { addEmail, removeEmail } from "@/lib/cloudflare";

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
