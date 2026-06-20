const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const rewards = await prisma.rewards.findMany()
  console.log(JSON.stringify(rewards, null, 2))
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
