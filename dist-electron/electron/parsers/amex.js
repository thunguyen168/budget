"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAmex = parseAmex;
const papaparse_1 = __importDefault(require("papaparse"));
const crypto = __importStar(require("crypto"));
const date_fns_1 = require("date-fns");
function hashAmex(date, description, amount) {
    return crypto
        .createHash('sha256')
        .update(`amex|${date}|${description}|${amount}`)
        .digest('hex')
        .slice(0, 32);
}
function parseAmex(csvText) {
    const result = papaparse_1.default.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
    });
    const headers = result.meta.fields ?? [];
    // Amex has a 3-column format: Date, Description, Amount
    const hasDate = headers.some((h) => h.toLowerCase().includes('date'));
    const hasDesc = headers.some((h) => h.toLowerCase().includes('description'));
    const hasAmount = headers.some((h) => h.toLowerCase().includes('amount'));
    if (!hasDate || !hasDesc || !hasAmount) {
        throw new Error('File does not appear to be an Amex CSV (expected Date, Description, Amount columns)');
    }
    // Normalise header names regardless of case
    const dateKey = headers.find((h) => h.toLowerCase().includes('date'));
    const descKey = headers.find((h) => h.toLowerCase().includes('description'));
    const amountKey = headers.find((h) => h.toLowerCase().includes('amount'));
    const transactions = [];
    for (const row of result.data) {
        const rawDate = (row[dateKey] || '').trim();
        const description = (row[descKey] || '').trim();
        const rawAmount = (row[amountKey] || '').trim();
        if (!rawDate || !description)
            continue;
        let dateObj = (0, date_fns_1.parse)(rawDate, 'dd/MM/yyyy', new Date());
        if (!(0, date_fns_1.isValid)(dateObj)) {
            dateObj = (0, date_fns_1.parse)(rawDate, 'MM/dd/yyyy', new Date());
        }
        if (!(0, date_fns_1.isValid)(dateObj))
            continue;
        const dateIso = (0, date_fns_1.format)(dateObj, 'yyyy-MM-dd');
        const rawNum = parseFloat(rawAmount.replace(/[£,]/g, ''));
        if (isNaN(rawNum))
            continue;
        if (rawNum === 0)
            continue;
        // Amex: positive = spending (already correct). Negative = payment to card.
        const amount = rawNum; // Keep as-is; negative payments will be categorised as Transfer
        const external_id = hashAmex(dateIso, description, rawAmount);
        transactions.push({
            external_id,
            date: dateIso,
            description,
            amount,
            original_amount: rawNum,
        });
    }
    return transactions;
}
