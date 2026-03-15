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
exports.parseNationwide = parseNationwide;
const papaparse_1 = __importDefault(require("papaparse"));
const crypto = __importStar(require("crypto"));
const date_fns_1 = require("date-fns");
function hashNationwide(date, desc, paidOut, paidIn, balance) {
    return crypto
        .createHash('sha256')
        .update(`nationwide|${date}|${desc}|${paidOut}|${paidIn}|${balance}`)
        .digest('hex')
        .slice(0, 32);
}
function stripCurrency(val) {
    return val.replace(/[£,\s]/g, '');
}
function parseNationwide(rawBuffer) {
    // Nationwide uses Latin-1 encoding
    const csvText = rawBuffer.toString('latin1');
    // Split lines to find the header row (starts with "Date","Transaction type")
    const lines = csvText.split(/\r?\n/);
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/^"/, '').toLowerCase();
        if (line.startsWith('date')) {
            headerIdx = i;
            break;
        }
    }
    if (headerIdx === -1) {
        throw new Error('Could not find header row in Nationwide CSV');
    }
    // Re-join from header row onward
    const csvBody = lines.slice(headerIdx).join('\n');
    const result = papaparse_1.default.parse(csvBody, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().replace(/^"|"$/g, ''),
    });
    const headers = result.meta.fields ?? [];
    const hasDate = headers.some((h) => h.toLowerCase() === 'date');
    if (!hasDate) {
        throw new Error('File does not appear to be a Nationwide CSV');
    }
    const descKey = headers.find((h) => /description/i.test(h)) ?? '';
    const paidOutKey = headers.find((h) => /paid out/i.test(h)) ?? '';
    const paidInKey = headers.find((h) => /paid in/i.test(h)) ?? '';
    const balanceKey = headers.find((h) => /balance/i.test(h)) ?? '';
    const transactions = [];
    for (const row of result.data) {
        const rawDate = (row['Date'] || '').trim().replace(/^"|"$/g, '');
        const description = (row[descKey] || '').trim().replace(/^"|"$/g, '');
        const paidOut = stripCurrency((row[paidOutKey] || '').trim());
        const paidIn = stripCurrency((row[paidInKey] || '').trim());
        const balance = stripCurrency((row[balanceKey] || '').trim());
        if (!rawDate)
            continue;
        // Nationwide date format: "15 Mar 2024"
        let dateObj = (0, date_fns_1.parse)(rawDate, 'dd MMM yyyy', new Date());
        if (!(0, date_fns_1.isValid)(dateObj)) {
            dateObj = (0, date_fns_1.parse)(rawDate, 'd MMM yyyy', new Date());
        }
        if (!(0, date_fns_1.isValid)(dateObj))
            continue;
        const dateIso = (0, date_fns_1.format)(dateObj, 'yyyy-MM-dd');
        let amount = 0;
        let originalAmount = 0;
        if (paidOut) {
            const n = parseFloat(paidOut);
            if (!isNaN(n)) {
                amount = n; // spending = positive
                originalAmount = n;
            }
        }
        else if (paidIn) {
            const n = parseFloat(paidIn);
            if (!isNaN(n)) {
                amount = -n; // income = negative
                originalAmount = n;
            }
        }
        if (amount === 0)
            continue;
        const external_id = hashNationwide(dateIso, description, paidOut, paidIn, balance);
        transactions.push({
            external_id,
            date: dateIso,
            description,
            amount,
            original_amount: originalAmount,
        });
    }
    return transactions;
}
