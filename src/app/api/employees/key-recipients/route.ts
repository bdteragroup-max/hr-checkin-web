import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const recipients = await prisma.employees.findMany({
            where: {
                is_active: true,
                departments: {
                    name: {
                        in: ["HR", "Admin", "General Affairs", "ธุรการ", "บุคคล", "ทรัพยากรบุคคล", "Human Resources   Dep.", "Human Resources Dep."]
                    }
                }
            },
            select: {
                emp_id: true,
                name: true,
                nickname: true,
                job_positions: {
                    select: { title: true }
                }
            }
        });

        // Fallback if department mapping isn't exact - return some users with related job titles
        if (recipients.length === 0) {
            const fallbackRecipients = await prisma.employees.findMany({
                where: {
                    is_active: true,
                    OR: [
                        { job_positions: { title: { contains: "HR", mode: "insensitive" } } },
                        { job_positions: { title: { contains: "Human", mode: "insensitive" } } },
                        { job_positions: { title: { contains: "Admin", mode: "insensitive" } } },
                        { job_positions: { title: { contains: "Purchas", mode: "insensitive" } } }
                    ]
                },
                select: {
                    emp_id: true,
                    name: true,
                    nickname: true,
                    job_positions: {
                        select: { title: true }
                    }
                }
            });
            return NextResponse.json(fallbackRecipients);
        }

        return NextResponse.json(recipients);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
