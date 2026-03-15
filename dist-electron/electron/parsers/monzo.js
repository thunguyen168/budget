"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMonzo = parseMonzo;
const papaparse_1 = __importDefault(require("papaparse"));
const date_fns_1 = require("date-fns");
const REQUIRED_HEADERS = ['Transaction ID', 'Date', 'Amount'];
function parseMonzo(csvText) {
    const result = papaparse_1.default.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
    });
    const headers = result.meta.fields ?? [];
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
        throw new Error(`Monzo CSV missing columns: ${missing.join(', ')}`);
    }
    const transactions = [];
    for (const row of result.data) {
        const transactionId = (row['Transaction ID'] || '').trim();
        const rawDate = (row['Date'] || '').trim();
        const name = (row['Name'] || row['Description'] || '').trim();
        const rawAmount = (row['Amount'] || '').trim();
        const monzoCategory = (row['Category'] || '').trim();
        if (!transactionId || !rawDate)
            continue;
        // Parse date: dd/mm/yyyy
        let dateObj = (0, date_fns_1.parse)(rawDate, 'dd/MM/yyyy', new Date());
        if (!(0, date_fns_1.isValid)(dateObj)) {
            dateObj = (0, date_fns_1.parse)(rawDate, 'yyyy-MM-dd', new Date());
        }
        if (!(0, date_fns_1.isValid)(dateObj))
            continue;
        const dateIso = (0, date_fns_1.format)(dateObj, 'yyyy-MM-dd');
        // Amount: negative in Monzo CSV = money out (spending). Flip to positive.
        const rawNum = parseFloat(rawAmount.replace(/[£,]/g, ''));
        if (isNaN(rawNum))
            continue;
        // Ignore zero-amount rows
        if (rawNum === 0)
            continue;
        const amount = -rawNum; // flip: Monzo negative → positive spending
        transactions.push({
            external_id: transactionId,
            date: dateIso,
            description: name || transactionId,
            amount,
            original_amount: rawNum,
            monzo_category: monzoCategory || undefined,
        });
    }
    return transactions;
}
