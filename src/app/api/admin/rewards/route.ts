import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        const rewards = await prisma.rewards.findMany({
            orderBy: [
                { is_active: 'desc' },
                { created_at: 'desc' }
            ]
        });
        return NextResponse.json({ ok: true, rewards });
    } catch (error: any) {
        console.error("GET Admin Rewards Error:", error);
        return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, image_url, costs, stock_quantity } = body;

        // Validation
        if (!name || !costs || !Array.isArray(costs) || costs.length === 0 || stock_quantity === undefined) {
            return NextResponse.json({ error: "Missing required fields or costs array" }, { status: 400 });
        }

        if (stock_quantity < 0) {
            return NextResponse.json({ error: "Invalid stock amount" }, { status: 400 });
        }

        for (const cost of costs) {
            if (!cost.coin_type || typeof cost.amount !== 'number' || cost.amount <= 0) {
                return NextResponse.json({ error: "Invalid cost structure" }, { status: 400 });
            }
            const coinType = await prisma.coin_types.findUnique({
                where: { id: cost.coin_type.toUpperCase() }
            });
            if (!coinType || !coinType.is_active) {
                return NextResponse.json({ error: `Invalid or inactive coin type: ${cost.coin_type}` }, { status: 400 });
            }
        }

        // Keep backward compatibility for required_coins and required_coin_type by taking the first item
        const required_coins = costs[0].amount;
        const required_coin_type = costs[0].coin_type.toUpperCase();

        const newReward = await prisma.rewards.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                image_url: image_url?.trim() || null,
                required_coins,
                required_coin_type,
                costs,
                stock_quantity,
                is_active: true
            }
        });

        return NextResponse.json({ ok: true, data: newReward });
    } catch (error: any) {
        console.error("POST Admin Rewards Error:", error);
        return NextResponse.json({ error: "Failed to create reward" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, name, description, image_url, costs, stock_quantity, is_active } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing reward ID" }, { status: 400 });
        }

        // Validate Coin Type if provided
        if (costs && Array.isArray(costs) && costs.length > 0) {
            for (const cost of costs) {
                if (!cost.coin_type || typeof cost.amount !== 'number' || cost.amount <= 0) {
                    return NextResponse.json({ error: "Invalid cost structure" }, { status: 400 });
                }
                const coinType = await prisma.coin_types.findUnique({
                    where: { id: cost.coin_type.toUpperCase() }
                });
                if (!coinType || !coinType.is_active) {
                    return NextResponse.json({ error: `Invalid or inactive coin type: ${cost.coin_type}` }, { status: 400 });
                }
            }
        }

        const updatedReward = await prisma.rewards.update({
            where: { id },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(image_url !== undefined && { image_url: image_url?.trim() || null }),
                ...(costs && costs.length > 0 && { 
                    costs,
                    required_coins: costs[0].amount,
                    required_coin_type: costs[0].coin_type.toUpperCase()
                }),
                ...(stock_quantity !== undefined && { stock_quantity }),
                ...(is_active !== undefined && { is_active }),
                updated_at: new Date()
            }
        });

        return NextResponse.json({ ok: true, data: updatedReward });
    } catch (error: any) {
        console.error("PUT Admin Rewards Error:", error);
        return NextResponse.json({ error: "Failed to update reward" }, { status: 500 });
    }
}
