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
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'use lowercase letters, numbers, and dashes'),
  name: z.string().trim().min(1).max(100),
  url: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'feed URL must use http or https'),
  category: categorySchema,
  trust: z.coerce.number().int().min(0).max(100).default(70),
  enabled: z.boolean().default(true),
  official: z.boolean().default(false),
});
export type NewsSource = z.infer<typeof sourceSchema>;

export const sourcesFileSchema = z.object({
  sources: z.array(sourceSchema).max(500),
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.sources.forEach((source, index) => {
    if (ids.has(source.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sources', index, 'id'],
        message: 'source id must be unique',
      });
    }
    ids.add(source.id);
  });
});

const terms = z.array(z.string().trim().min(1).max(120)).max(500);

export const rulesSchema = z.object({
  blocked_topics: terms.default([]),
  high_value_terms: terms.default([]),
  breaking_terms: terms.default([]),
  low_value_terms: terms.default([]),
  categories: z.record(z.object({ terms: terms.default([]) })).default({}),
});
export type Rules = z.infer<typeof rulesSchema>;
