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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const schema_1 = require("./database/schema");
const seed_1 = require("./database/seed");
const queries_1 = require("./database/queries");
const Q = __importStar(require("./database/queries"));
const index_1 = require("./parsers/index");
const isDev = process.env.NODE_ENV === 'development';
// ── Database setup ────────────────────────────────────────────────────────────
function initDatabase() {
    const userDataPath = electron_1.app.getPath('userData');
    const dbPath = path.join(userDataPath, 'budgetlens.db');
    const db = new better_sqlite3_1.default(dbPath);
    (0, schema_1.createSchema)(db);
    (0, seed_1.seedDatabase)(db);
    (0, queries_1.setDb)(db);
}
// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
        title: 'BudgetLens',
    });
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    return win;
}
// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers() {
    electron_1.ipcMain.handle('dialog:openFile', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });
        return result.filePaths;
    });
    electron_1.ipcMain.handle('csv:parse', (_e, filePath) => {
        return (0, index_1.parseCSVFile)(filePath);
    });
    electron_1.ipcMain.handle('db:getAccounts', () => Q.getAccounts());
    electron_1.ipcMain.handle('db:addAccount', (_e, data) => Q.addAccount(data));
    electron_1.ipcMain.handle('db:updateAccount', (_e, id, data) => Q.updateAccount(id, data));
    electron_1.ipcMain.handle('db:detectTransfers', (_e, windowDays) => Q.detectTransfers(windowDays));
    electron_1.ipcMain.handle('db:applyTransfers', (_e, txIds) => Q.applyTransfers(txIds));
    electron_1.ipcMain.handle('db:toggleTransfer', (_e, id) => Q.toggleTransfer(id));
    electron_1.ipcMain.handle('db:importTransactions', (_e, data) => Q.importTransactions(data));
    electron_1.ipcMain.handle('db:getImportHistory', () => Q.getImportHistory());
    electron_1.ipcMain.handle('db:getTransactions', (_e, filters) => Q.getTransactions(filters ?? {}));
    electron_1.ipcMain.handle('db:updateTransaction', (_e, id, updates) => {
        Q.updateTransaction(id, updates);
    });
    electron_1.ipcMain.handle('db:getCategories', () => Q.getCategories());
    electron_1.ipcMain.handle('db:addCategory', (_e, data) => Q.addCategory(data));
    electron_1.ipcMain.handle('db:updateCategory', (_e, id, data) => Q.updateCategory(id, data));
    electron_1.ipcMain.handle('db:deleteCategory', (_e, id) => Q.deleteCategory(id));
    electron_1.ipcMain.handle('db:getSavingsHistory', () => Q.getSavingsHistory());
    electron_1.ipcMain.handle('db:getBudgets', (_e, forDate) => Q.getBudgets(forDate));
    electron_1.ipcMain.handle('db:updateBudget', (_e, id, amount) => Q.updateBudget(id, amount));
    electron_1.ipcMain.handle('db:getRules', () => Q.getCategorisationRules());
    electron_1.ipcMain.handle('db:addRule', (_e, data) => Q.addRule(data));
    electron_1.ipcMain.handle('db:updateRule', (_e, id, data) => Q.updateRule(id, data));
    electron_1.ipcMain.handle('db:deleteRule', (_e, id) => Q.deleteRule(id));
    electron_1.ipcMain.handle('db:getDashboardData', (_e, month) => Q.getDashboardData(month));
    electron_1.ipcMain.handle('db:exportData', async () => {
        const csv = Q.exportAllData();
        const { filePath } = await electron_1.dialog.showSaveDialog({
            defaultPath: `budgetlens-export-${new Date().toISOString().slice(0, 10)}.csv`,
            filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        if (filePath) {
            fs.writeFileSync(filePath, csv, 'utf8');
            electron_1.shell.showItemInFolder(filePath);
        }
        return csv;
    });
    electron_1.ipcMain.handle('db:deleteAllData', () => Q.deleteAllData());
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    initDatabase();
    registerIpcHandlers();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
