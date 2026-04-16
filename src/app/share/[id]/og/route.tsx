import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { UserIcon, ClockIcon } from "@heroicons/react/24/outline";

export const runtime = "edge"; // 🚀 Use Edge runtime for fastest performance (no Prisma needed)

function decodeBase64Safe(val: string | null) {
    if (!val) return "";
    try {
        return Buffer.from(val, 'base64').toString('utf8');
    } catch {
        return "";
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    
    // 🚀 Read data from URL parameters (Zero DB hits!)
    const name = decodeBase64Safe(searchParams.get("n")) || "HR Staff";
    const typeStr = decodeBase64Safe(searchParams.get("t")) || "Check-in";
    const location = decodeBase64Safe(searchParams.get("l")) || "—";
    const timeStr = decodeBase64Safe(searchParams.get("tm")) || "—";
    const photoUrl = decodeBase64Safe(searchParams.get("p")) || null;
    const remark = decodeBase64Safe(searchParams.get("r")) || "";

    const isOut = typeStr.includes("OUT");
    const title = typeStr.includes("นอกสถานที่") ? "รายงานเช็กอินนอกสถานที่" : (typeStr.includes("โครงการ") ? "รายงานปฏิบัติงานโครงการ" : "รายงานการเช็กอินพนักงาน");
    
    const gradientStart = isOut ? "#f97316" : "#10b981";
    const gradientEnd = isOut ? "#ea580c" : "#059669";

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    background: "#ffffff",
                    fontFamily: "Inter, sans-serif",
                }}
            >
                {/* Left: Photo section (Wider for clarity) */}
                <div
                    style={{
                        width: "480px",
                        height: "100%",
                        display: "flex",
                        position: "relative",
                        overflow: "hidden",
                        borderRight: "8px solid #f1f5f9",
                    }}
                >
                    {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={photoUrl}
                            alt=""
                            width={480}
                            height={630}
                            style={{
                                objectFit: "cover",
                                width: "480px",
                                height: "630px",
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#f8fafc",
                                color: "#cbd5e1",
                                fontSize: 100,
                            }}
                        >
                            <UserIcon width={120} height={120} color="#cbd5e1" strokeWidth={1} />
                        </div>
                    )}
                </div>

                {/* Right: Info section */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        padding: "0",
                        background: "white",
                    }}
                >
                    {/* Header bar */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "36px 40px",
                            background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
                            color: "white",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    opacity: 0.9,
                                    letterSpacing: "3px",
                                    textTransform: "uppercase" as const,
                                    marginBottom: 6,
                                }}
                            >
                                OFFICIAL ATTENDANCE
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 800 }}>
                                {title}
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            padding: "40px 50px",
                            gap: "28px",
                        }}
                    >
                        {/* Name (Larger for visibility) */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 18, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                                ชื่อพนักงาน / NAME
                            </div>
                            <div style={{ fontSize: 42, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                                {name}
                            </div>
                        </div>

                        {/* Type & Time Row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    background: isOut ? "#fff7ed" : "#f0fdf4",
                                    border: `2px solid ${isOut ? "#fed7aa" : "#bbf7d0"}`,
                                    borderRadius: "14px",
                                    padding: "10px 24px",
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: isOut ? "#ea580c" : "#15803d",
                                }}
                            >
                                {typeStr}
                            </div>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: "#334155",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <ClockIcon width={28} height={28} strokeWidth={2} />
                                {timeStr}
                            </div>
                        </div>

                        {/* Location */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 18, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                                สถานที่ / LOCATION
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: "#1e293b" }}>
                                {location}
                            </div>
                        </div>

                        {/* Remark (More visible) */}
                        {remark && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "16px",
                                    padding: "16px 24px",
                                }}
                            >
                                <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
                                    Note / Remark
                                </div>
                                <div
                                    style={{
                                        fontSize: 22,
                                        color: "#334155",
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        maxHeight: "62px",
                                    }}
                                >
                                    {remark}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "20px 40px",
                            borderTop: "1px solid #f1f5f9",
                            color: "#cbd5e1",
                            fontSize: 16,
                            fontWeight: 600,
                            letterSpacing: "1px",
                        }}
                    >
                        THAI HR CHECK-IN SYSTEM • {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        ),
        { width: 1200, height: 630 }
    );
}
