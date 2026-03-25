import type { Prisma } from '@prisma/client';

export interface TenantFeatureFlags {
  outboundEnabled: boolean;
  coldOutboundEnabled: boolean;
}

export const DEFAULT_TENANT_FEATURE_FLAGS: TenantFeatureFlags = {
  outboundEnabled: false,
  coldOutboundEnabled: false,
};

export function normalizeTenantFeatureFlags(
  value?: Prisma.JsonValue | null,
): TenantFeatureFlags {
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    outboundEnabled:
      typeof input.outboundEnabled === 'boolean'
        ? input.outboundEnabled
        : DEFAULT_TENANT_FEATURE_FLAGS.outboundEnabled,
    coldOutboundEnabled:
      typeof input.coldOutboundEnabled === 'boolean'
        ? input.coldOutboundEnabled
        : DEFAULT_TENANT_FEATURE_FLAGS.coldOutboundEnabled,
  };
}

export function toTenantFeatureFlagsJson(
  value: TenantFeatureFlags,
): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
