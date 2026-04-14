import type { Prisma } from '@prisma/client';

export interface TenantFeatureFlags {
  outboundEnabled: boolean;
  coldOutboundEnabled: boolean;
  businessHours?: {
    enabled: boolean;
    timezone: string;       // e.g., "America/Sao_Paulo"
    days: number[];         // 0=Sun,1=Mon...6=Sat; default [1,2,3,4,5]
    startHour: number;      // e.g., 8
    endHour: number;        // e.g., 18
  };
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
