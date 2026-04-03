import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

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
    const name = decodeBase64Safe(searchParams.get("n")) || "—";
    const typeStr = decodeBase64Safe(searchParams.get("t")) || "—";
    const location = decodeBase64Safe(searchParams.get("l")) || "—";
    const timeStr = decodeBase64Safe(searchParams.get("tm")) || "—";
    const photoUrl = decodeBase64Safe(searchParams.get("p")) || null;
    const remark = decodeBase64Safe(searchParams.get("r")) || "";

    const isOut = typeStr.includes("OUT");
    const title = typeStr.includes("นอกสถานที่") ? "เช็กอินนอกสถานที่" : (typeStr.includes("โครงการ") ? "ปฏิบัติงานโครงการ" : "เช็กอินพนักงาน");
    
    const gradientStart = isOut ? "#f97316" : "#10b981";
    const gradientEnd = isOut ? "#ea580c" : "#059669";

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    background: "#f8fafc",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Left: Photo section */}
                <div
                    style={{
                        width: "420px",
                        height: "100%",
                        display: "flex",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={photoUrl}
                            alt=""
                            width={420}
                            height={630}
                            style={{
                                objectFit: "cover",
                                width: "420px",
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
                                background: "#e2e8f0",
                                color: "#94a3b8",
                                fontSize: 64,
                            }}
                        >
                            📷
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
                    }}
                >
                    {/* Header bar */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "28px 40px",
                            background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
                            color: "white",
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
                                    fontSize: 16,
                                    fontWeight: 600,
                                    opacity: 0.85,
                                    letterSpacing: "2px",
                                    textTransform: "uppercase" as const,
                                    marginBottom: 4,
                                }}
                            >
                                OFFICIAL RECORD
                            </div>
                            <div style={{ fontSize: 30, fontWeight: 700 }}>
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
                            padding: "30px 44px",
                            gap: "24px",
                        }}
                    >
                        {/* Name */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
                                พนักงาน
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 700, color: "#0f172a" }}>
                                {name}
                            </div>
                        </div>

                        {/* Type badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    background: isOut ? "#fff7ed" : "#f0fdf4",
                                    border: `2px solid ${isOut ? "#fed7aa" : "#bbf7d0"}`,
                                    borderRadius: "12px",
                                    padding: "8px 20px",
                                    fontSize: 26,
                                    fontWeight: 700,
                                    color: isOut ? "#ea580c" : "#16a34a",
                                }}
                            >
                                {typeStr}
                            </div>
                        </div>

                        {/* Location */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
                                สถานที่ / โครงการ
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 600, color: "#1e293b" }}>
                                {location}
                            </div>
                        </div>

                        {/* Time */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
                                เวลาบันทึก
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 600, color: "#1e293b" }}>
                                {timeStr}
                            </div>
                        </div>

                        {/* Remark */}
                        {remark && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    background: "#f1f5f9",
                                    borderRadius: "12px",
                                    padding: "14px 20px",
                                }}
                            >
                                <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                                    หมายเหตุ
                                </div>
                                <div
                                    style={{
                                        fontSize: 20,
                                        color: "#334155",
                                        lineHeight: 1.4,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        maxHeight: "56px",
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
                            padding: "16px 40px",
                            borderTop: "1px solid #e2e8f0",
                            color: "#94a3b8",
                            fontSize: 14,
                        }}
                    >
                        © THAI HR CHECK-IN SYSTEM
                    </div>
                </div>
            </div>
        ),
        { width: 1200, height: 630 }
    );
}
