import { os } from "@orpc/server";
import { z } from "zod";
import { runSparkrunJson } from "@/lib/sparkrun";
import { ClusterEntrySchema } from "@/lib/schemas";

const ClusterRawSchema = z
  .object({
    name: z.string(),
    hosts: z.array(z.string()).default([]),
    description: z.string().optional(),
    default: z.boolean().default(false),
  })
  .transform((c) => ({
    name: c.name,
    hosts: c.hosts,
    description: c.description ?? "",
    is_default: c.default,
  }));

export const list = os.output(z.array(ClusterEntrySchema)).handler(async () => {
  const raw = await runSparkrunJson<unknown>(["cluster", "list", "--json"]);
  return z.array(ClusterRawSchema).parse(raw);
});

export const getDefault = os.output(ClusterEntrySchema.nullable()).handler(async () => {
  try {
    const raw = await runSparkrunJson<unknown>(["cluster", "default", "--json"]);
    return ClusterRawSchema.parse(raw);
  } catch {
    return null;
  }
});
