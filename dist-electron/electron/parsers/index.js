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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSVFile = parseCSVFile;
const fs = __importStar(require("fs"));
const monzo_1 = require("./monzo");
const amex_1 = require("./amex");
const nationwide_1 = require("./nationwide");
function detectBankType(firstLine, headers) {
    const h = headers.toLowerCase();
    if (h.includes('transaction id') && h.includes('category'))
        return 'monzo';
    if (h.includes('transaction type') && h.includes('paid out'))
        return 'nationwide';
    // Amex: very simple 3-column CSV
    if (h.includes('date') && h.includes('description') && h.includes('amount'))
        return 'amex';
    return null;
}
function parseCSVFile(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        // Try UTF-8 first for header detection
        const text = buffer.toString('utf8');
        const lines = text.split(/\r?\n/);
        // For Nationwide the real header is after metadata rows
        let headerLine = '';
        for (const line of lines.slice(0, 10)) {
            const stripped = line.replace(/"/g, '').toLowerCase();
            if (stripped.startsWith('date') || stripped.startsWith('transaction id')) {
                headerLine = line.toLowerCase();
                break;
            }
        }
        const bankType = detectBankType(lines[0] ?? '', headerLine);
        if (!bankType) {
            return { transactions: [], bankType: 'monzo', error: 'Could not detect bank type. Please check the file format.' };
        }
        let transactions;
        if (bankType === 'monzo') {
            transactions = (0, monzo_1.parseMonzo)(text);
        }
        else if (bankType === 'amex') {
            transactions = (0, amex_1.parseAmex)(text);
        }
        else {
            // Nationwide: must pass raw buffer for Latin-1 decoding
            transactions = (0, nationwide_1.parseNationwide)(buffer);
        }
        return { transactions, bankType };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { transactions: [], bankType: 'monzo', error: msg };
    }
}
