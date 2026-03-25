const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// IDs identificados no diagnóstico como órfãos
const pipelinesToDelete = [
  '51aaacb8-ab1a-4090-b947-a89671a75669', // SERVUS...
  '33cbafe5-bcaa-4fbe-bb23-516cf71ec819', // SERVUS...
  '6ca60047-acd0-4eec-a1a5-f164a9cbcf71', // MARCIO TESTE PIPA
];

async function main() {
  console.log('--- INICIANDO LIMPEZA DE ÓRFÃOS ---');

  for (const id of pipelinesToDelete) {
    try {
      // Como o DB está com Cascade Delete, excluir o pipeline remove Stages e Cards
      const deleted = await prisma.pipeline.delete({
        where: { id }
      });
      console.log(`[SUCESSO] Pipeline removido: "${deleted.name}" (ID: ${id})`);
    } catch (err) {
      console.error(`[ERRO] Falha ao remover pipeline ID ${id}:`, err.message);
    }
  }

  console.log('--- LIMPEZA FINALIZADA ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
