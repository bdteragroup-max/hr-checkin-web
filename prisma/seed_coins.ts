import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding HR Coin types and exchange rates...");

  const coinTypes = [
    { id: "BRONZE", name: "Bronze Coin", description: "Earned from daily check-ins" },
    { id: "SILVER", name: "Silver Coin", description: "Exchanged from Bronze coins" },
    { id: "GOLD", name: "Gold Medal", description: "Exchanged from Silver or rewarded for milestones" },
    { id: "KPI", name: "KPI Coin", description: "Quarterly KPI reward" },
    { id: "MILESTONE", name: "Milestone Coin", description: "Birthdays and anniversaries" },
    { id: "EVENT", name: "Event Coin", description: "Participation in company events" },
  ];

  for (const ct of coinTypes) {
    await prisma.coin_types.upsert({
      where: { id: ct.id },
      update: { name: ct.name, description: ct.description },
      create: ct,
    });
  }

  const exchangeRates = [
    { from_coin_type: "BRONZE", to_coin_type: "SILVER", exchange_rate: 20 },
    { from_coin_type: "SILVER", to_coin_type: "GOLD", exchange_rate: 10 },
  ];

  for (const rate of exchangeRates) {
    await prisma.coin_exchange_rates.upsert({
      where: {
        from_coin_type_to_coin_type: {
          from_coin_type: rate.from_coin_type,
          to_coin_type: rate.to_coin_type,
        },
      },
      update: { exchange_rate: rate.exchange_rate },
      create: rate,
    });
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
