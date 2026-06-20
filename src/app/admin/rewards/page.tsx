"use client";

import { useEffect, useState } from "react";
import styles from "./rewards.module.css";
import { PlusIcon, PencilSquareIcon, PhotoIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface Reward {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    required_coins: number;
    required_coin_type: string;
    costs?: { coin_type: string, amount: number }[];
    stock_quantity: number;
    is_active: boolean;
}

export default function AdminRewardsPage() {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [costs, setCosts] = useState<{coin_type: string, amount: number}[]>([{coin_type: "BRONZE", amount: 1}]);
    const [stockQuantity, setStockQuantity] = useState(10);
    const [isActive, setIsActive] = useState(true);

    const COIN_TYPES = ["BRONZE", "SILVER", "GOLD", "KPI", "TASK", "EVENT"];

    useEffect(() => {
        fetchRewards();
    }, []);

    const fetchRewards = async () => {
        try {
            const res = await fetch("/api/admin/rewards");
            const data = await res.json();
            if (data.ok) {
                setRewards(data.rewards);
            } else {
                setError(data.error || "ไม่สามารถดึงข้อมูลของรางวัลได้");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (reward?: Reward) => {
        if (reward) {
            setEditingReward(reward);
            setName(reward.name);
            setDescription(reward.description || "");
            setImageUrl(reward.image_url || "");
            setImageFile(null);
            setImagePreview("");
            setCosts(reward.costs && reward.costs.length > 0 ? reward.costs : [{coin_type: reward.required_coin_type, amount: reward.required_coins}]);
            setStockQuantity(reward.stock_quantity);
            setIsActive(reward.is_active);
        } else {
            setEditingReward(null);
            setName("");
            setDescription("");
            setImageUrl("");
            setImageFile(null);
            setImagePreview("");
            setCosts([{coin_type: "BRONZE", amount: 1}]);
            setStockQuantity(10);
            setIsActive(true);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingReward(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);

        let finalImageUrl = imageUrl;
        
        try {
            if (imageFile) {
                const formData = new FormData();
                formData.append("file", imageFile);
                formData.append("prefix", "reward");
                
                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData
                });
                
                const uploadData = await uploadRes.json();
                if (uploadData.ok && uploadData.url) {
                    finalImageUrl = uploadData.url;
                } else {
                    alert("Upload failed: " + (uploadData.error || "Unknown error"));
                    setActionLoading(false);
                    return;
                }
            }

            const payload = {
                id: editingReward?.id,
                name,
                description,
                image_url: finalImageUrl,
                costs,
                stock_quantity: stockQuantity,
                is_active: isActive
            };

            const method = editingReward ? "PUT" : "POST";

            const res = await fetch("/api/admin/rewards", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.ok) {
                await fetchRewards();
                handleCloseModal();
            } else {
                alert(data.error || "ไม่สามารถบันทึกของรางวัลได้");
            }
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย");
        } finally {
            setActionLoading(false);
        }
    };

    const filteredRewards = rewards.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>จัดการของรางวัล</h1>
                    <p className={styles.subtitle}>จัดการรายการของรางวัลและจำนวนสต๊อกสินค้า</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className={styles.searchWrapper} style={{ minWidth: 300 }}>
                        <MagnifyingGlassIcon width={18} className={styles.searchIcon} />
                        <input 
                            type="text" 
                            className={styles.searchInput}
                            placeholder="ค้นหาชื่อของรางวัล..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className={styles.addBtn} onClick={() => handleOpenModal()}>
                        <PlusIcon width={20} /> เพิ่มของรางวัล
                    </button>
                </div>
            </div>

            <div className={styles.statsBar}>
                <div className={`${styles.statCard} ${styles.active}`}>
                    <span className={styles.statLabel}>ของรางวัลทั้งหมด</span>
                    <span className={styles.statVal}>{rewards.length}</span>
                </div>
                <div className={`${styles.statCard}`}>
                    <span className={styles.statLabel}>เปิดใช้งานอยู่</span>
                    <span className={styles.statVal} style={{ color: "#16a34a" }}>{rewards.filter(r => r.is_active).length}</span>
                </div>
                <div className={`${styles.statCard}`}>
                    <span className={styles.statLabel}>สินค้าใกล้หมดสต๊อก</span>
                    <span className={styles.statVal} style={{ color: "#d97706" }}>{rewards.filter(r => r.stock_quantity > 0 && r.stock_quantity <= 5).length}</span>
                </div>
                <div className={`${styles.statCard}`}>
                    <span className={styles.statLabel}>สินค้าหมด</span>
                    <span className={styles.statVal} style={{ color: "#dc2626" }}>{rewards.filter(r => r.stock_quantity === 0).length}</span>
                </div>
            </div>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>รูปภาพ</th>
                            <th>ชื่อของรางวัล</th>
                            <th>ราคา (เหรียญ)</th>
                            <th>จำนวนสต๊อกคงเหลือ</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className={styles.loading}>กำลังโหลด...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={6} className={styles.loading} style={{color: "var(--bad)"}}>{error}</td></tr>
                        ) : filteredRewards.length === 0 ? (
                            <tr><td colSpan={6} className={styles.loading}>ไม่พบข้อมูลของรางวัล</td></tr>
                        ) : filteredRewards.map(reward => (
                            <tr key={reward.id}>
                                <td>
                                    <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {reward.image_url ? (
                                            <img src={reward.image_url} alt={reward.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <PhotoIcon width={24} style={{ color: '#94a3b8' }} />
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.assetName}>{reward.name}</div>
                                    <div className={styles.assetId} style={{maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{reward.description || "ไม่มีรายละเอียด"}</div>
                                </td>
                                <td>
                                    {reward.costs && reward.costs.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {reward.costs.map((c, i) => (
                                                <span key={i} style={{ fontWeight: 700 }}>{c.amount} {c.coin_type}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ fontWeight: 700 }}>{reward.required_coins} {reward.required_coin_type}</span>
                                    )}
                                </td>
                                <td>
                                    <span style={{ 
                                        fontWeight: 700, 
                                        color: reward.stock_quantity === 0 ? "#dc2626" : reward.stock_quantity <= 5 ? "#d97706" : "#16a34a" 
                                    }}>
                                        {reward.stock_quantity} ชิ้น
                                    </span>
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${reward.is_active ? styles.fulfilled : styles.rejected}`}>
                                        {reward.is_active ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                                    </span>
                                </td>
                                <td>
                                    <button className={styles.editBtn} onClick={() => handleOpenModal(reward)}>
                                        <PencilSquareIcon width={18} style={{marginRight: 4}} /> แก้ไข
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} style={{ width: 500 }} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingReward ? "แก้ไขข้อมูลของรางวัล" : "เพิ่มของรางวัลใหม่"}</h2>
                            <p>กำหนดรายละเอียดของรางวัลและเงื่อนไขการแลก</p>
                        </div>
                        <div className={styles.modalScroll} style={{ maxHeight: "60vh" }}>
                            <form id="rewardForm" onSubmit={handleSubmit}>
                                <div className={styles.inputGroup}>
                                    <label>ชื่อของรางวัล</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>รายละเอียด</label>
                                    <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>เงื่อนไขการแลก (เหรียญที่ต้องใช้)</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--line)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
                                        {costs.map((cost, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <input type="number" value={cost.amount} onChange={e => {
                                                        const newCosts = [...costs];
                                                        newCosts[idx].amount = Number(e.target.value);
                                                        setCosts(newCosts);
                                                    }} min={1} required placeholder="จำนวนเหรียญ" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <select 
                                                        value={cost.coin_type} 
                                                        onChange={e => {
                                                            const newCosts = [...costs];
                                                            newCosts[idx].coin_type = e.target.value;
                                                            setCosts(newCosts);
                                                        }}
                                                        style={{ width: '100%', padding: 12, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}
                                                    >
                                                        {COIN_TYPES.map(ct => (
                                                            <option key={ct} value={ct}>{ct}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {costs.length > 1 && (
                                                    <button type="button" onClick={() => {
                                                        const newCosts = costs.filter((_, i) => i !== idx);
                                                        setCosts(newCosts);
                                                    }} style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                                                        ลบ
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setCosts([...costs, { coin_type: "BRONZE", amount: 1 }])} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', borderRadius: 6, border: '1px dashed #cbd5e1', cursor: 'pointer', marginTop: 4 }}>
                                            + เพิ่มเหรียญที่ต้องใช้
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                                        <label>จำนวนในสต๊อก</label>
                                        <input type="number" value={stockQuantity} onChange={e => setStockQuantity(Number(e.target.value))} min={0} required />
                                    </div>
                                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                                        <label>สถานะ</label>
                                        <div className={styles.checkboxGroup} style={{ marginTop: 8 }}>
                                            <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                                            <label htmlFor="isActive" style={{margin: 0, color: isActive ? "#15803d" : "#b91c1c"}}>{isActive ? "เปิดใช้งาน" : "ระงับการใช้งาน"}</label>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>รูปภาพ (แนะนำ 500x500px, ขนาดไม่เกิน 15MB)</label>
                                    <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
                                        {(imagePreview || imageUrl) ? (
                                            <img src={imagePreview || imageUrl} style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)'}} />
                                        ) : (
                                            <div style={{width: 80, height: 80, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)'}}>
                                                <PhotoIcon width={28} style={{color: '#94a3b8'}} />
                                            </div>
                                        )}
                                        <div style={{flex: 1}}>
                                            <input 
                                                type="file" 
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        setImageFile(f);
                                                        setImagePreview(URL.createObjectURL(f));
                                                        setImageUrl(""); // Clear URL if a file is chosen
                                                    }
                                                }}
                                                style={{ fontSize: 13, display: 'block', marginBottom: 8 }}
                                            />
                                            <div style={{fontSize: 12, color: "var(--text4)", marginBottom: 4}}>หรือใช้ URL ของรูปภาพ (สำหรับรูปภาพจากภายนอก):</div>
                                            <input 
                                                type="url" 
                                                value={imageUrl} 
                                                onChange={e => {
                                                    setImageUrl(e.target.value);
                                                    if (e.target.value) {
                                                        setImageFile(null);
                                                        setImagePreview("");
                                                    }
                                                }} 
                                                placeholder="https://example.com/image.jpg" 
                                                style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: 13 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={handleCloseModal}>ยกเลิก</button>
                            <button type="submit" form="rewardForm" className={styles.confirmBtn} disabled={actionLoading}>
                                {actionLoading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
