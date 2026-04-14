import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.tenantId) {
      request.tenantId = user.tenantId;
    }

    return true; // We don't block here, just inject tenantId if present.
  }
}
