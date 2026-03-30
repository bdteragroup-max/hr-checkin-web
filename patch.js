const fs = require('fs');

const path = 'src/app/api/admin/employees/route.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. CreateEmployeeBody
code = code.replace(
    '    has_telephone_allowance?: boolean;\r\n    position_allowance?: number | null;\r\n};',
    '    has_telephone_allowance?: boolean;\r\n    position_allowance?: number | null;\r\n    national_id_card?: string | null;\r\n    address?: string | null;\r\n    bank_name?: string | null;\r\n    bank_account_no?: string | null;\r\n};'
);

// 2. PatchEmployeeBody
code = code.replace(
    '    has_telephone_allowance?: boolean;\n    position_allowance?: number | null;\n\n    //',
    '    has_telephone_allowance?: boolean;\n    position_allowance?: number | null;\n    national_id_card?: string | null;\n    address?: string | null;\n    bank_name?: string | null;\n    bank_account_no?: string | null;\n\n    //'
);
code = code.replace(
    '    has_telephone_allowance?: boolean;\r\n    position_allowance?: number | null;\r\n\r\n    //',
    '    has_telephone_allowance?: boolean;\r\n    position_allowance?: number | null;\r\n    national_id_card?: string | null;\r\n    address?: string | null;\r\n    bank_name?: string | null;\r\n    bank_account_no?: string | null;\r\n\r\n    //'
);

// 3. GET Query Selection
code = code.replace(
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n            },',
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n                national_id_card: true,\r\n                address: true,\r\n                bank_name: true,\r\n                bank_account_no: true,\r\n            },'
);

// 4. POST prisma create
code = code.replace(
    '                is_on_trial: body.is_on_trial ?? false,\r\n                has_telephone_allowance: body.has_telephone_allowance ?? false,\r\n                position_allowance: body.position_allowance != null ? Number(body.position_allowance) : 0,\r\n            },',
    '                is_on_trial: body.is_on_trial ?? false,\r\n                has_telephone_allowance: body.has_telephone_allowance ?? false,\r\n                position_allowance: body.position_allowance != null ? Number(body.position_allowance) : 0,\r\n                national_id_card: body.national_id_card ? clean(body.national_id_card) : null,\r\n                address: body.address ? clean(body.address) : null,\r\n                bank_name: body.bank_name ? clean(body.bank_name) : null,\r\n                bank_account_no: body.bank_account_no ? clean(body.bank_account_no) : null,\r\n            },'
);

// 5. POST return select
code = code.replace(
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n            },',
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n                national_id_card: true,\r\n                address: true,\r\n                bank_name: true,\r\n                bank_account_no: true,\r\n            },'
);

// 6. PATCH map data
code = code.replace(
    '        if (body.position_allowance !== undefined) {\r\n            data.position_allowance = body.position_allowance != null ? Number(body.position_allowance) : 0;\r\n        }',
    '        if (body.position_allowance !== undefined) {\r\n            data.position_allowance = body.position_allowance != null ? Number(body.position_allowance) : 0;\r\n        }\r\n\r\n        if (body.national_id_card !== undefined) {\r\n            data.national_id_card = body.national_id_card ? clean(body.national_id_card) : null;\r\n        }\r\n        if (body.address !== undefined) {\r\n            data.address = body.address ? clean(body.address) : null;\r\n        }\r\n        if (body.bank_name !== undefined) {\r\n            data.bank_name = body.bank_name ? clean(body.bank_name) : null;\r\n        }\r\n        if (body.bank_account_no !== undefined) {\r\n            data.bank_account_no = body.bank_account_no ? clean(body.bank_account_no) : null;\r\n        }'
);

// 7. PATCH return select
code = code.replace(
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n            },',
    '                is_on_trial: true,\r\n                has_telephone_allowance: true,\r\n                position_allowance: true,\r\n                national_id_card: true,\r\n                address: true,\r\n                bank_name: true,\r\n                bank_account_no: true,\r\n            },'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully patched route.ts');
