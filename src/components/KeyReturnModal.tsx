"use client";

import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { CameraIcon, ClockIcon, XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

type Step = "warning" | "photo" | "signature";

interface KeyReturnModalProps {
    borrowingId: number;
    assetName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function KeyReturnModal({ borrowingId, assetName, onClose, onSuccess }: KeyReturnModalProps) {
    const [step, setStep] = useState<Step>("warning");
    const [keyPhoto, setKeyPhoto] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [recipients, setRecipients] = useState<{ emp_id: string; name: string; nickname?: string | null; job_positions?: { title: string } }[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const sigCanvas = useRef<SignatureCanvas>(null);

    useEffect(() => {
        fetch("/api/employees/key-recipients")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRecipients(data);
            })
            .catch(err => console.error("Failed to load key recipients", err));
    }, []);

    async function compressImage(file: File): Promise<File | Blob> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1600;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
                            } else {
                                resolve(file);
                            }
                        },
                        "image/jpeg",
                        0.8
                    );
                };
            };
        });
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setAlertMsg("");
        
        try {
            const processedFile = file.type.startsWith("image/") ? await compressImage(file) : file;

            const form = new FormData();
            form.append("file", processedFile);
            form.append("prefix", "key-return");

            const res = await fetch("/api/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.ok) {
                setKeyPhoto(data.url);
            } else {
                setAlertMsg(data.error === "FILE_TOO_LARGE" ? "ไฟล์รูปภาพใหญ่เกินไป กรุณาลดความละเอียด" : (data.error || "Upload Failed"));
            }
        } catch (err) {
            console.error(err);
            setAlertMsg("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function handleSubmit() {
        if (!selectedRecipient) {
            setAlertMsg("กรุณาเลือกผู้รับกุญแจ");
            return;
        }
        
        if (sigCanvas.current?.isEmpty()) {
            setAlertMsg("กรุณาเซ็นชื่อรับกุญแจ");
            return;
        }

        const signatureDataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
        
        setSubmitting(true);
        setAlertMsg("");

        try {
            // First upload the signature to Supabase
            const blob = await (await fetch(signatureDataUrl!)).blob();
            const form = new FormData();
            form.append("file", blob, "signature.png");
            form.append("prefix", "key-signature");
            
            const sigRes = await fetch("/api/upload", { method: "POST", body: form });
            const sigData = await sigRes.json();
            
            if (!sigData.ok) {
                setAlertMsg("ไม่สามารถอัปโหลดลายเซ็นได้");
                setSubmitting(false);
                return;
            }

            const res = await fetch("/api/assets/return-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    borrowing_id: borrowingId,
                    key_photo_url: keyPhoto,
                    key_received_by: selectedRecipient,
                    key_signature_url: sigData.url
                })
            });

            const data = await res.json();
            if (data.ok) {
                onSuccess();
            } else {
                setAlertMsg(data.error || "เกิดข้อผิดพลาด");
            }
        } catch (err: any) {
            setAlertMsg(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: "16px" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                
                {/* Header */}
                <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>คืนกุญแจรถยนต์</h2>
                    <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
                        <XMarkIcon width={24} />
                    </button>
                </div>

                <div style={{ padding: "20px" }}>
                    {alertMsg && (
                        <div style={{ backgroundColor: "#fef2f2", color: "#b91c1c", padding: "10px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", textAlign: "center" }}>
                            {alertMsg}
                        </div>
                    )}

                    {/* Step 1: Warning */}
                    {step === "warning" && (
                        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                            <div style={{ backgroundColor: "#fffbeb", padding: "16px", borderRadius: "50%" }}>
                                <ExclamationTriangleIcon width={48} color="#d97706" />
                            </div>
                            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                                <ExclamationTriangleIcon width={24} /> การคืนรถยังไม่เสร็จสมบูรณ์
                            </h3>
                            <p style={{ fontSize: "14px", color: "#475569", margin: 0, lineHeight: 1.5 }}>
                                การคืนรถยนต์ {assetName} จะสมบูรณ์ก็ต่อเมื่อคุณได้ทำการ <span style={{fontWeight: 700, color: "#0f172a"}}>คืนกุญแจรถยนต์</span> ให้กับเจ้าหน้าที่แล้ว
                            </p>
                            
                            <div style={{ display: "flex", width: "100%", gap: "12px", marginTop: "16px" }}>
                                <button 
                                    onClick={onClose}
                                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    onClick={() => setStep("photo")}
                                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                                >
                                    ดำเนินการคืนกุญแจ →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Photo */}
                    {step === "photo" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <CameraIcon width={20} /> ถ่ายรูปกุญแจรถยนต์
                            </h3>
                            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, textAlign: "center" }}>
                                กรุณาถ่ายรูปกุญแจรถที่คุณส่งคืน เพื่อเป็นหลักฐาน
                            </p>

                            <div style={{ border: "2px dashed #cbd5e1", borderRadius: "12px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", backgroundColor: "#f8fafc" }}>
                                {keyPhoto ? (
                                    <>
                                        <img src={keyPhoto} alt="Key" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        <div style={{ position: "absolute", bottom: "10px", right: "10px" }}>
                                            <input type="file" accept="image/*" capture="environment" id="reupload-key" style={{ display: "none" }} onChange={handlePhotoUpload} />
                                            <label htmlFor="reupload-key" style={{ padding: "6px 12px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: "20px", fontSize: "12px", cursor: "pointer" }}>
                                                เปลี่ยนรูป
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <input type="file" accept="image/*" capture="environment" id="upload-key" style={{ display: "none" }} onChange={handlePhotoUpload} />
                                        <label htmlFor="upload-key" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", cursor: "pointer", width: "100%", height: "100%", justifyContent: "center" }}>
                                            {uploading ? (
                                                <><ClockIcon width={24} className="animate-spin" color="#64748b" /> <span style={{fontSize: "13px", color: "#64748b"}}>กำลังอัปโหลด...</span></>
                                            ) : (
                                                <><CameraIcon width={32} color="#94a3b8" /> <span style={{fontSize: "14px", fontWeight: 600, color: "#0f172a"}}>กดเพื่อถ่ายรูป / อัปโหลด</span></>
                                            )}
                                        </label>
                                    </>
                                )}
                            </div>

                            <div style={{ display: "flex", width: "100%", gap: "12px", marginTop: "8px" }}>
                                <button 
                                    onClick={() => setStep("warning")}
                                    style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                                >
                                    ← ย้อนกลับ
                                </button>
                                <button 
                                    onClick={() => {
                                        if (!keyPhoto) {
                                            setAlertMsg("กรุณาถ่ายรูปกุญแจรถก่อนไปขั้นตอนถัดไป");
                                            return;
                                        }
                                        setStep("signature");
                                        setAlertMsg("");
                                    }}
                                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: keyPhoto ? "#0f172a" : "#94a3b8", color: "#fff", fontWeight: 600, cursor: keyPhoto ? "pointer" : "not-allowed" }}
                                    disabled={!keyPhoto}
                                >
                                    ถัดไป →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Signature */}
                    {step === "signature" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <PencilSquareIcon width={20} /> ผู้รับกุญแจรถ
                            </h3>
                            
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>ชื่อผู้รับกุญแจ (HR)</label>
                                <select 
                                    value={selectedRecipient} 
                                    onChange={(e) => setSelectedRecipient(e.target.value)}
                                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "#fff" }}
                                >
                                    <option value="">-- เลือกผู้รับกุญแจ --</option>
                                    {recipients.map(r => (
                                        <option key={r.emp_id} value={r.emp_id}>
                                            {r.name} {r.nickname ? `(${r.nickname})` : ""} - {r.job_positions?.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                    <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>ลายเซ็นผู้รับ</label>
                                    <button 
                                        onClick={() => sigCanvas.current?.clear()}
                                        style={{ fontSize: "11px", color: "#ef4444", border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}
                                    >
                                        [ล้างลายเซ็น]
                                    </button>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", backgroundColor: "#f8fafc" }}>
                                    <SignatureCanvas 
                                        ref={sigCanvas} 
                                        canvasProps={{ width: 360, height: 150, style: { width: "100%", touchAction: "none" } }} 
                                        backgroundColor="#f8fafc"
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", width: "100%", gap: "12px", marginTop: "8px" }}>
                                <button 
                                    onClick={() => setStep("photo")}
                                    disabled={submitting}
                                    style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                                >
                                    ← ย้อนกลับ
                                </button>
                                <button 
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#16a34a", color: "#fff", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                                >
                                    {submitting ? (
                                        <><ClockIcon width={18} className="animate-spin" /> กำลังบันทึก...</>
                                    ) : (
                                        <><CheckCircleIcon width={18} /> ยืนยันการคืนรถ</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
