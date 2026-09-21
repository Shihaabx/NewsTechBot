import { z } from 'zod';

export const categorySchema = z.enum([
  'ai',
  'pc-hardware',
  'windows-software',
  'gaming-tech',
  'cybersecurity',
  'general-tech',
]);
export type Category = z.infer<typeof categorySchema>;

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  category: categorySchema,
  trust: z.number().min(0).max(100).default(70),
  enabled: z.boolean().default(true),
  official: z.boolean().default(false),
});
export type NewsSource = z.infer<typeof sourceSchema>;

export const sourcesFileSchema = z.object({
  sources: z.array(sourceSchema),
});

export const rulesSchema = z.object({
  blocked_topics: z.array(z.string()).default([]),
  high_value_terms: z.array(z.string()).default([]),
  breaking_terms: z.array(z.string()).default([]),
  low_value_terms: z.array(z.string()).default([]),
  categories: z.record(z.object({ terms: z.array(z.string()).default([]) })).default({}),
});
export type Rules = z.infer<typeof rulesSchema>;
