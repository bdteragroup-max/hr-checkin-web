const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding assets...");
  
  const sampleAssets = [
    { asset_id: "NB-001", name: "Laptop Dell Vostro", category: "Notebook", description: "i7, 16GB RAM" },
    { asset_id: "NB-002", name: "Laptop HP ProBook", category: "Notebook", description: "i5, 8GB RAM" },
    { asset_id: "PR-001", name: "Projector Epson", category: "Peripheral", description: "HDMI/VGA Support" },
    { asset_id: "CA-001", name: "Digital Camera Canon", category: "Camera", description: "DSLR with 18-55mm lens" },
    { asset_id: "TL-001", name: "Screwdriver Set", category: "Tool", description: "32 pieces precision set" },
    { asset_id: "TL-002", name: "Power Drill Bosch", category: "Tool", description: "Cordless 18V" },
  ];

  for (const asset of sampleAssets) {
    await prisma.assets.upsert({
      where: { asset_id: asset.asset_id },
      update: { status: "available" },
      create: { ...asset, status: "available" }
    });
  }

  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
