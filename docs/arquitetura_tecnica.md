# Arquitetura Técnica — CRM Autônomo com IA

## 1. Estrutura do Monorepo

```
saaso/
├── apps/
│   ├── web/                     # Next.js (Frontend)
│   │   ├── src/
│   │   │   ├── app/             # App Router (pages + layouts)
│   │   │   ├── components/      # Componentes reutilizáveis
│   │   │   ├── hooks/           # Custom hooks
│   │   │   ├── services/        # Classes de serviço (API clients)
│   │   │   ├── stores/          # Zustand stores
│   │   │   ├── types/           # Interfaces e tipos
│   │   │   └── lib/             # Utilitários
│   │   └── tailwind.config.ts
│   │
│   └── api/                     # NestJS (Backend)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/        # AuthModule
│       │   │   ├── tenant/      # TenantModule
│       │   │   ├── user/        # UserModule
│       │   │   ├── pipeline/    # PipelineModule
│       │   │   ├── stage/       # StageModule
│       │   │   ├── card/        # CardModule
│       │   │   ├── contact/     # ContactModule
│       │   │   ├── company/     # CompanyModule
│       │   │   ├── journey/     # JourneyModule
│       │   │   ├── agent/       # AgentModule
│       │   │   ├── knowledge/   # KnowledgeModule
│       │   │   ├── whatsapp/    # WhatsAppModule
│       │   │   ├── billing/     # BillingModule
│       │   │   └── analytics/   # AnalyticsModule
│       │   ├── common/
│       │   │   ├── guards/      # JwtGuard, RolesGuard, TenantGuard
│       │   │   ├── decorators/  # @CurrentUser, @CurrentTenant, @Roles
│       │   │   ├── filters/     # HttpExceptionFilter
│       │   │   ├── interceptors/# TransformInterceptor, LoggingInterceptor
│       │   │   └── pipes/       # ValidationPipe customizado
│       │   ├── prisma/          # PrismaService, PrismaModule
│       │   └── main.ts
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── packages/
│   └── shared/                  # Tipos, enums, constantes compartilhados
│       ├── types/
│       ├── enums/
│       └── constants/
│
├── docker-compose.yml
├── .env.example
└── turbo.json                   # Turborepo config
```

---

## 2. Padrão de Módulo NestJS

Cada módulo segue a estrutura:

```
modules/pipeline/
├── pipeline.module.ts          # Declaração do módulo
├── pipeline.controller.ts     # Rotas REST
├── pipeline.service.ts        # Lógica de negócio
├── dto/
│   ├── create-pipeline.dto.ts
│   └── update-pipeline.dto.ts
├── entities/
│   └── pipeline.entity.ts     # Tipo de retorno (mapped do Prisma)
└── pipeline.constants.ts      # Constantes do módulo
```

**Convenções:**
- Controllers: apenas roteamento, validação de input e delegação ao service
- Services: lógica de negócio, queries Prisma, validações de regra
- DTOs: `class-validator` + `class-transformer` para validação de input
- Entities: tipos de retorno (não expor modelo Prisma diretamente)

---

## 3. Multi-tenancy: Tenant Isolation

```typescript
// TenantGuard extrai tenantId do JWT e injeta no request
@Injectable()
class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // do JwtGuard
    request.tenantId = user.tenantId;
    return true;
  }
}

// Decorador para acessar tenantId
const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().tenantId;
  }
);
```

> [!CAUTION]
> **TODA** query ao banco deve filtrar por `tenantId`. Sem exceção. Implementar middleware Prisma para enforcement automático.

---

## 4. Schema Prisma (Entidades Core)

```prisma
model Tenant {
  id            String   @id @default(uuid())
  name          String
  slug          String   @unique
  plan          PlanType @default(FREE)
  stripeCustomerId String?
  createdAt     DateTime @default(now())

  users         User[]
  pipelines     Pipeline[]
  contacts      Contact[]
  agents        Agent[]
  knowledgeBases KnowledgeBase[]
  whatsappAccounts WhatsAppAccount[]
  subscriptions Subscription[]
}

model User {
  id        String   @id @default(uuid())
  email     String
  password  String
  name      String
  role      UserRole
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())

  @@unique([email, tenantId])
}

model Pipeline {
  id        String   @id @default(uuid())
  name      String
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  stages    Stage[]
  createdAt DateTime @default(now())
}

model Stage {
  id         String   @id @default(uuid())
  name       String
  order      Int
  pipelineId String
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id])
  cards      Card[]
  agents     Agent[]
}

model Card {
  id           String   @id @default(uuid())
  title        String
  stageId      String
  stage        Stage    @relation(fields: [stageId], references: [id])
  contactId    String?
  contact      Contact? @relation(fields: [contactId], references: [id])
  assigneeId   String?
  customFields Json?
  position     Int
  tenantId     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  activities   CardActivity[]
}

model Contact {
  id        String   @id @default(uuid())
  name      String
  phone     String?
  email     String?
  tags      String[]
  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  cards     Card[]
  messages  WhatsAppMessage[]
  createdAt DateTime @default(now())
}

model Agent {
  id              String   @id @default(uuid())
  name            String
  systemPrompt    String
  isActive        Boolean  @default(true)
  stageId         String?
  stage           Stage?   @relation(fields: [stageId], references: [id])
  knowledgeBaseId String?
  knowledgeBase   KnowledgeBase? @relation(fields: [knowledgeBaseId], references: [id])
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  conversations   AgentConversation[]
  createdAt       DateTime @default(now())
}

enum UserRole {
  OWNER
  ADMIN
  MANAGER
  AGENT
}

enum PlanType {
  FREE
  STARTER
  PRO
  ENTERPRISE
}
```

---

## 5. Filas e Jobs (BullMQ)

| Fila | Propósito | Prioridade |
|---|---|---|
| `whatsapp:outgoing` | Envio de mensagens WhatsApp | Alta |
| `whatsapp:incoming` | Processamento de webhooks recebidos | Alta |
| `agent:process` | Processamento de resposta do agente IA | Média |
| `journey:execute` | Execução de nós de jornada | Média |
| `knowledge:embed` | Embedding de documentos | Baixa |
| `billing:sync` | Sincronização de uso com Stripe | Baixa |

---

## 6. Integrações Externas

| Serviço | Uso | Autenticação |
|---|---|---|
| **WhatsApp Cloud API** | Mensageria | Bearer token (System User Token) |
| **OpenAI API** | Chat completions + Embeddings | API Key |
| **Stripe** | Pagamentos, subscriptions | Secret Key + Webhooks |

---

## 7. Variáveis de Ambiente (.env.example)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/saaso

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_VERIFY_TOKEN=your-verify-token

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# App
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
```

---

## 8. Convenções de Código

Conforme regras do projeto:
- **Zero `any`**: toda variável, retorno e propriedade explicitamente tipada
- **Classes + OOP**: services, controllers e entities como classes
- **SRP**: métodos ≤ 20 linhas, refatorar se exceder
- **`readonly` e `const`** por padrão
- **Early returns** para evitar aninhamento
- **Erros específicos**: nunca mensagens genéricas
- **Fail fast**: validar inputs no topo do método
- **Modificadores de acesso**: `private` por padrão, `public` só quando necessário
