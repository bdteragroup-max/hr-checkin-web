const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
    const username = "admin";
    const password = "password123"; // You should change this after login
    const pepper = process.env.ADMIN_PEPPER;

    if (!pepper) {
        console.error("ADMIN_PEPPER is not defined in .env");
        process.exit(1);
    }

    console.log("Creating admin account...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password + pepper, salt);

    try {
        const admin = await prisma.admins.upsert({
            where: { username },
            update: {
                password_hash: passwordHash,
                full_name: "System Administrator"
            },
            create: {
                username,
                password_hash: passwordHash,
                full_name: "System Administrator"
            }
        });
        console.log("Admin account created/updated:", admin.username);
    } catch (error) {
        console.error("Error creating admin:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
