const fs = require('fs');
const path = 'src/app/admin/employees/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Types
code = code.replace(
    '    has_telephone_allowance: boolean;\r\n    position_allowance?: number | null;\r\n};',
    '    has_telephone_allowance: boolean;\r\n    position_allowance?: number | null;\r\n    national_id_card?: string | null;\r\n    address?: string | null;\r\n    bank_account_no?: string | null;\r\n    bank_name?: string | null;\r\n};'
);

code = code.replace(
    '    has_telephone_allowance: boolean;\r\n    position_allowance: string;\r\n};',
    '    has_telephone_allowance: boolean;\r\n    position_allowance: string;\r\n    national_id_card: string;\r\n    address: string;\r\n    bank_account_no: string;\r\n    bank_name: string;\r\n};'
);

// 2. State
code = code.replace(
    '    const [positionAllowance, setPositionAllowance] = useState("");',
    '    const [positionAllowance, setPositionAllowance] = useState("");\r\n    const [nationalIdCard, setNationalIdCard] = useState("");\r\n    const [address, setAddress] = useState("");\r\n    const [bankAccountNo, setBankAccountNo] = useState("");\r\n    const [bankName, setBankName] = useState("");'
);

// 3. create function body JSON
code = code.replace(
    '                    has_telephone_allowance: hasTelephoneAllowance,\r\n                    position_allowance: positionAllowance ? Number(positionAllowance) : 0,\r\n                }),',
    '                    has_telephone_allowance: hasTelephoneAllowance,\r\n                    position_allowance: positionAllowance ? Number(positionAllowance) : 0,\r\n                    national_id_card: nationalIdCard.trim() || null,\r\n                    address: address.trim() || null,\r\n                    bank_account_no: bankAccountNo.trim() || null,\r\n                    bank_name: bankName.trim() || null,\r\n                }),'
);

// 4. create function cleanup
code = code.replace(
    '            setPositionAllowance("");\r\n            setCreateModalOpen(false);',
    '            setPositionAllowance("");\r\n            setNationalIdCard(""); setAddress(""); setBankAccountNo(""); setBankName("");\r\n            setCreateModalOpen(false);'
);

// 5. saveEdit function body JSON
code = code.replace(
    '                    has_telephone_allowance: editDraft.has_telephone_allowance,\r\n                    position_allowance: editDraft.position_allowance ? Number(editDraft.position_allowance) : 0,\r\n                }),',
    '                    has_telephone_allowance: editDraft.has_telephone_allowance,\r\n                    position_allowance: editDraft.position_allowance ? Number(editDraft.position_allowance) : 0,\r\n                    national_id_card: editDraft.national_id_card.trim() || null,\r\n                    address: editDraft.address.trim() || null,\r\n                    bank_account_no: editDraft.bank_account_no.trim() || null,\r\n                    bank_name: editDraft.bank_name.trim() || null,\r\n                }),'
);

// 6. setEditDraft in row edit button
code = code.replace(
    '                                                                    has_telephone_allowance: x.has_telephone_allowance,\r\n                                                                    position_allowance: x.position_allowance ? String(x.position_allowance) : "",\r\n                                                                });',
    '                                                                    has_telephone_allowance: x.has_telephone_allowance,\r\n                                                                    position_allowance: x.position_allowance ? String(x.position_allowance) : "",\r\n                                                                    national_id_card: x.national_id_card || "",\r\n                                                                    address: x.address || "",\r\n                                                                    bank_account_no: x.bank_account_no || "",\r\n                                                                    bank_name: x.bank_name || "",\r\n                                                                });'
);

// 7. Make modals wider (finding <div className={styles.modal}> and replacing with style tag)
code = code.replace(
    /<div className=\{styles\.modal\}>/g,
    '<div className={styles.modal} style={{ maxWidth: 700 }}>'
);

// 8. Add inputs to Create modal
// We will insert them right after `gender` block
const createInputs = `
                            <label className={styles.lbl}>เลขบัตรประจำตัวประชาชน</label>
                            <input className={styles.input} placeholder="1-xxxx-xxxxx-xx-x"
                                value={nationalIdCard} onChange={(e) => setNationalIdCard(e.target.value)} />

                            <label className={styles.lbl}>ที่อยู่</label>
                            <textarea className={styles.input} placeholder="ที่อยู่ปัจจุบัน"
                                value={address} onChange={(e) => setAddress(e.target.value)} style={{ minHeight: 60 }} />

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label className={styles.lbl}>ธนาคาร</label>
                                    <input className={styles.input} placeholder="เช่น กสิกรไทย"
                                        value={bankName} onChange={(e) => setBankName(e.target.value)} />
                                </div>
                                <div>
                                    <label className={styles.lbl}>เลขบัญชีธนาคาร</label>
                                    <input className={styles.input} placeholder="000-0-00000-0"
                                        value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
                                </div>
                            </div>
`;

code = code.replace(
    '</select>\r\n\r\n                            <label className={styles.lbl}>วันที่เริ่มงาน',
    '</select>\r\n' + createInputs + '\r\n                            <label className={styles.lbl}>วันที่เริ่มงาน'
);

// 9. Add inputs to Edit modal
const editInputs = `
                        <label className={styles.lbl}>เลขบัตรประจำตัวประชาชน</label>
                        <input className={styles.input} placeholder="1-xxxx-xxxxx-xx-x"
                            value={editDraft.national_id_card} onChange={(e) => setEditDraft((d) => d && ({ ...d, national_id_card: e.target.value }))} />

                        <label className={styles.lbl}>ที่อยู่</label>
                        <textarea className={styles.input} placeholder="ที่อยู่ปัจจุบัน" style={{ minHeight: 60 }}
                            value={editDraft.address} onChange={(e) => setEditDraft((d) => d && ({ ...d, address: e.target.value }))} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label className={styles.lbl}>ธนาคาร</label>
                                <input className={styles.input} placeholder="เช่น กสิกรไทย"
                                    value={editDraft.bank_name} onChange={(e) => setEditDraft((d) => d && ({ ...d, bank_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className={styles.lbl}>เลขบัญชีธนาคาร</label>
                                <input className={styles.input} placeholder="000-0-00000-0"
                                    value={editDraft.bank_account_no} onChange={(e) => setEditDraft((d) => d && ({ ...d, bank_account_no: e.target.value }))} />
                            </div>
                        </div>
`;

code = code.replace(
    '</select>\r\n                            </div>\r\n                        </div>\r\n\r\n                        {/* Hire date',
    '</select>\r\n                            </div>\r\n                        </div>\r\n\r\n' + editInputs + '\r\n                        {/* Hire date'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully patched page.tsx!');
