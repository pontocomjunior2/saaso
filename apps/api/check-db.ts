import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const campaignId = '3fb1e9de-d71f-4a25-b362-db55f45a38e2';
  console.log(`Buscando campanha: ${campaignId}`);
  
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  
  console.log('Campaign:', JSON.stringify(campaign, null, 2));

  if (campaign) {
    const journeys = await prisma.journey.findMany({
      where: { tenantId: campaign.tenantId },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log('Last 10 Journeys in Tenant:', JSON.stringify(journeys, null, 2));
    
    // Test the exact logic
    const matchedJourney = await prisma.journey.findFirst({
      where: {
        tenantId: campaign.tenantId,
        OR: [
          { name: { contains: campaign.name } },
          { name: { startsWith: campaign.name } },
          { name: `${campaign.name} · Regua` },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    console.log('\nMatched Journey via OR condition:', JSON.stringify(matchedJourney ? { id: matchedJourney.id, name: matchedJourney.name } : null, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
