import { Metadata, ResolvingMetadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatTimeFull24h } from "@/utils/time";
import {
    UserIcon,
    MapPinIcon,
    ClockIcon,
    DocumentTextIcon,
    GlobeAltIcon,
    BuildingOfficeIcon
} from "@heroicons/react/24/outline";

type Props = {
    params: Promise<{ id: string }>;
};

// ── METADATA (For LINE Preview) ──
export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const id = (await params).id;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hr-checkin-web.vercel.app";

    try {
        const checkin = await prisma.checkins.findUnique({
            where: { id: BigInt(id) },
        });

        if (!checkin) return { title: "Check-in Report" };

        const typeStr = checkin.type.includes("In") ? "เข้างาน (IN)" : "ออกงาน (OUT)";
        const location = checkin.project_name || checkin.branch_name || "สถานที่ปฏิบัติงาน";
        
        // 🚀 Encode data into URL to avoid DB hits in the OG route
        const encodedData = new URLSearchParams({
            n: Buffer.from(checkin.name).toString('base64'),
            t: Buffer.from(typeStr).toString('base64'),
            l: Buffer.from(location).toString('base64'),
            tm: Buffer.from(formatTimeFull24h(checkin.timestamp)).toString('base64'),
            p: checkin.photo_url ? Buffer.from(checkin.photo_url).toString('base64') : '',
            r: checkin.remark ? Buffer.from(checkin.remark.substring(0, 50)).toString('base64') : ''
        }).toString();

        // 🚀 Force Big Card Support with .png extension hint
        const imageUrl = `${baseUrl}/share/${id}/og?${encodedData}&.png`;

        return {
            title: `เช็กอิน: ${checkin.name}`,
            description: `${typeStr} ณ ${location}\n🕒 เวลา: ${formatTimeFull24h(checkin.timestamp)} น.`,
            openGraph: {
                title: `📍 รายงานการเช็กอิน: ${checkin.name}`,
                description: `${typeStr} ณ ${location}\n🕒 เวลา: ${formatTimeFull24h(checkin.timestamp)} น.`,
                type: "website",
                images: [
                    {
                        url: imageUrl,
                        width: 1200,
                        height: 630,
                        type: "image/png",
                        alt: `Check-in Report: ${checkin.name}`,
                    },
                ],
            },
            twitter: {
                card: "summary_large_image",
                title: `📍 เช็กอินพนักงาน: ${checkin.name}`,
                images: [imageUrl],
            },
        };
    } catch (error) {
        // 🛠️ Resilience Fallback: If DB is full, still show a generic card to LINE
        console.error("Metadata DB Error:", error);
        const fallbackUrl = `${baseUrl}/share/${id}/og?n=SFIgUmVjb3Jk&t=Q2hlY2staW4=&.png`; // "HR Record", "Check-in"
        return {
            title: "Check-in Report (Processing)",
            openGraph: {
                title: "📍 รายงานการเช็กอิน (กำลังประมวลผล)",
                images: [{ 
                    url: fallbackUrl, 
                    width: 1200, 
                    height: 630,
                    type: "image/png"
                }],
            },
            twitter: {
                card: "summary_large_image",
                images: [fallbackUrl],
            }
        };
    }
}

// ── PAGE COMPONENT ──
export default async function SharePage({ params }: Props) {
    const id = (await params).id;

    try {
        const checkin = await prisma.checkins.findUnique({
            where: { id: BigInt(id) },
        });

        if (!checkin) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
                        <h1>ไม่พบข้อมูลการเช็กอิน</h1>
                        <p>รายการนี้อาจถูกลบหรือลิงก์ไม่ถูกต้อง</p>
                    </div>
                </div>
            );
        }

        const typeStr = checkin.type.includes("In") ? "เข้างาน (IN)" : "ออกงาน (OUT)";
        const isProject = checkin.type.includes("Project");
        const isOffsite = checkin.type.includes("Offsite");
        const title = isOffsite ? "รายงานการเช็กอินนอกสถานที่" : (isProject ? "รายงานการปฏิบัติงานในโครงการ" : "รายงานการเช็กอินพนักงาน");

        return (
            <div style={{
                background: "#f8fafc",
                minHeight: "100vh",
                padding: "24px 16px",
                fontFamily: "'Prompt', 'Sarabun', sans-serif",
                color: "#1e293b"
            }}>
                <div style={{
                    maxWidth: "500px",
                    margin: "0 auto",
                    background: "white",
                    borderRadius: "24px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                    overflow: "hidden"
                }}>
                    {/* Header Section */}
                    <div style={{
                        background: checkin.type.includes("Out") ? "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        padding: "32px 24px",
                        color: "white",
                        textAlign: "center"
                    }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, opacity: 0.9, marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            OFFICIAL RECORD
                        </div>
                        <h1 style={{ fontSize: "22px", margin: 0, fontWeight: 700, lineHeight: 1.2 }}>{title}</h1>
                    </div>

                    {/* Photo Section */}
                    {checkin.photo_url && (
                        <div style={{ position: "relative", width: "100%", padding: "20px" }}>
                            <div style={{
                                borderRadius: "16px",
                                overflow: "hidden",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                aspectRatio: "4/5",
                                background: "#f1f5f9"
                            }}>
                                <img
                                    src={checkin.photo_url}
                                    alt="Check-in Photo"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Details Section */}
                    <div style={{ padding: "8px 24px 32px" }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* 👤 Employee */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '10px', color: '#64748b' }}>
                                    <UserIcon width={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>พนักงาน</div>
                                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>{checkin.name}</div>
                                </div>
                            </div>

                            {/* 📝 Type */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '10px', color: '#64748b' }}>
                                    <DocumentTextIcon width={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>ประเภท</div>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '16px', fontWeight: 700, color: checkin.type.includes("Out") ? "#ef4444" : "#10b981" }}>
                                        {typeStr}
                                    </div>
                                </div>
                            </div>

                            {/* 🏢 Location */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '10px', color: '#64748b' }}>
                                    <BuildingOfficeIcon width={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>สถานที่ / โครงการ</div>
                                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                                        {checkin.project_name || checkin.branch_name || "—"}
                                    </div>
                                </div>
                            </div>

                            {/* 🕒 Time */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '10px', color: '#64748b' }}>
                                    <ClockIcon width={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>เวลาบันทึก</div>
                                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                                        {formatTimeFull24h(checkin.timestamp)} น.
                                    </div>
                                </div>
                            </div>

                            {/* 📍 GPS & Map */}
                            {checkin.lat && checkin.lon && (
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '10px', color: '#64748b' }}>
                                        <GlobeAltIcon width={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>พิกัด & แผนที่</div>
                                        <div style={{ fontSize: '15px', color: '#334155', fontWeight: 500, marginBottom: '8px' }}>
                                            {Number(checkin.lat).toFixed(5)}, {Number(checkin.lon).toFixed(5)}
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps?q=${checkin.lat},${checkin.lon}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                textDecoration: 'none',
                                                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
                                            }}
                                        >
                                            <MapPinIcon width={16} /> ดูบน Google Maps
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* 💬 Remark */}
                            {checkin.remark && (
                                <div style={{
                                    background: '#f8fafc',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    border: '1px solid #e2e8f0',
                                    marginTop: '10px'
                                }}>
                                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <DocumentTextIcon width={16} /> หมายเหตุ / บันทึกหน้างาน
                                    </div>
                                    <div style={{ fontSize: '15px', color: '#334155', lineHeight: 1.5 }}>
                                        {checkin.remark}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        padding: "20px 24px",
                        borderTop: "1px solid #f1f5f9",
                        background: "#fcfdfe",
                        textAlign: "center",
                        fontSize: "12px",
                        color: "#94a3b8"
                    }}>
                        © {new Date().getFullYear()} THAI HR CHECK-IN SYSTEM
                    </div>
                </div>

                {/* Simple styling for responsiveness */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    body { margin: 0; padding: 0; }
                    * { box-sizing: border-box; }
                    h1, h2, h3 { font-family: 'Prompt', sans-serif; }
                `}} />
            </div>
        );
    } catch (error) {
        console.error("Page DB Error:", error);
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
                <div>
                    <div style={{ fontSize: '64px', marginBottom: '20px' }}>☁️</div>
                    <h1 style={{ color: '#1e293b' }}>ระบบหนาแน่นชั่วคราว</h1>
                    <p style={{ color: '#64748b', fontSize: '18px' }}>ขณะนี้มีการเข้าใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่อีกครั้งครับ</p>
                    <button 
                        onClick={() => typeof window !== 'undefined' && window.location.reload()}
                        style={{ marginTop: '20px', padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        ลองโหลดใหม่อีกครั้ง
                    </button>
                </div>
            </div>
        );
    }
}
