import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.tenantId) {
      throw new UnauthorizedException(
        'Erro no Backend: Tenant ID não encontrado na requisição.',
      );
    }
    return request.tenantId;
  },
);
