import { z } from 'zod';

const storageDriverSchema = z.enum(['local', 'nas']);
const optionalPathSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional()
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().trim().min(1).optional(),
    APP_PUBLIC_BASE_URL: z.string().trim().url(),
    IMAGE_STORAGE_DRIVER: storageDriverSchema.default('local'),
    IMAGE_STORAGE_LOCAL_PATH: optionalPathSchema,
    IMAGE_STORAGE_NAS_PATH: optionalPathSchema
  })
  .superRefine((data, context) => {
    if (data.IMAGE_STORAGE_DRIVER === 'local' && !data.IMAGE_STORAGE_LOCAL_PATH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IMAGE_STORAGE_LOCAL_PATH'],
        message: 'IMAGE_STORAGE_LOCAL_PATH is required when IMAGE_STORAGE_DRIVER=local.'
      });
    }

    if (data.IMAGE_STORAGE_DRIVER === 'nas' && !data.IMAGE_STORAGE_NAS_PATH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IMAGE_STORAGE_NAS_PATH'],
        message: 'IMAGE_STORAGE_NAS_PATH is required when IMAGE_STORAGE_DRIVER=nas.'
      });
    }
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnv(env: NodeJS.ProcessEnv): ValidatedEnv {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Environment validation failed: ${message}`);
  }

  return parsed.data;
}
