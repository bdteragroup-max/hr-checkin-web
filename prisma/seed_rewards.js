const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if we already have rewards
  const existingCount = await prisma.rewards.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing rewards. Skipping seed.`);
    return;
  }

  console.log("Seeding initial rewards...");

  const rewardsToCreate = [
    {
      name: "TeraGroup Premium T-Shirt",
      description: "High quality, breathable cotton t-shirt with the TeraGroup logo. Perfect for casual Fridays or offsite events.",
      image_url: "/images/rewards/tshirt.png",
      required_coins: 50,
      required_coin_type: "silver",
      stock_quantity: 100,
      is_active: true
    },
    {
      name: "Extra Annual Leave Day",
      description: "Need a break? Redeem this for an extra paid day off! Subject to supervisor approval of the dates.",
      image_url: "/images/rewards/leave.png",
      required_coins: 5,
      required_coin_type: "gold",
      stock_quantity: 10,
      is_active: true
    },
    {
      name: "$20 Coffee Shop Gift Card",
      description: "Fuel your mornings! A digital gift card to a premium coffee shop chain.",
      image_url: "/images/rewards/coffee.png",
      required_coins: 200,
      required_coin_type: "bronze",
      stock_quantity: 50,
      is_active: true
    },
    {
      name: "TeraGroup Tumbler",
      description: "Keep your drinks hot or cold for hours with this stylish branded stainless steel tumbler.",
      image_url: "/images/rewards/tumbler.png",
      required_coins: 100,
      required_coin_type: "silver",
      stock_quantity: 30,
      is_active: true
    },
    {
      name: "1-on-1 Lunch with the CEO",
      description: "A rare opportunity to have an exclusive 1-on-1 lunch with our CEO to discuss ideas, vision, and career growth.",
      image_url: "/images/rewards/lunch.png",
      required_coins: 10,
      required_coin_type: "kpi",
      stock_quantity: 2,
      is_active: true
    }
  ];

  for (const reward of rewardsToCreate) {
    await prisma.rewards.create({
      data: reward
    });
    console.log(`Created reward: ${reward.name}`);
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
