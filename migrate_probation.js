const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('Connected to db');

    try {
        await client.query('ALTER TABLE "employees" ADD COLUMN "probation_accommodation_allowance" BOOLEAN NOT NULL DEFAULT false;');
        console.log('Added probation_accommodation_allowance');
    } catch (e) {
        console.log(e.message);
    }
    
    try {
        await client.query('ALTER TABLE "employees" ADD COLUMN "probation_meal_allowance" BOOLEAN NOT NULL DEFAULT false;');
        console.log('Added probation_meal_allowance');
    } catch (e) {
        console.log(e.message);
    }
    
    try {
        await client.query('ALTER TABLE "employees" ADD COLUMN "probation_travel_allowance" BOOLEAN NOT NULL DEFAULT false;');
        console.log('Added probation_travel_allowance');
    } catch (e) {
        console.log(e.message);
    }

    await client.end();
    console.log('Done');
}

migrate();
