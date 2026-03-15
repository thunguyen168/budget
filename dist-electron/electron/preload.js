"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // File dialog
    openFileDialog: () => electron_1.ipcRenderer.invoke('dialog:openFile'),
    // Parsing
    parseCSVFile: (filePath) => electron_1.ipcRenderer.invoke('csv:parse', filePath),
    // Accounts
    getAccounts: () => electron_1.ipcRenderer.invoke('db:getAccounts'),
    addAccount: (data) => electron_1.ipcRenderer.invoke('db:addAccount', data),
    updateAccount: (id, data) => electron_1.ipcRenderer.invoke('db:updateAccount', id, data),
    // Transfers
    detectTransfers: (windowDays) => electron_1.ipcRenderer.invoke('db:detectTransfers', windowDays),
    applyTransfers: (txIds) => electron_1.ipcRenderer.invoke('db:applyTransfers', txIds),
    toggleTransfer: (id) => electron_1.ipcRenderer.invoke('db:toggleTransfer', id),
    // Import
    importTransactions: (data) => electron_1.ipcRenderer.invoke('db:importTransactions', data),
    getImportHistory: () => electron_1.ipcRenderer.invoke('db:getImportHistory'),
    // Transactions
    getTransactions: (filters) => electron_1.ipcRenderer.invoke('db:getTransactions', filters),
    updateTransaction: (id, updates) => electron_1.ipcRenderer.invoke('db:updateTransaction', id, updates),
    // Categories
    getCategories: () => electron_1.ipcRenderer.invoke('db:getCategories'),
    addCategory: (data) => electron_1.ipcRenderer.invoke('db:addCategory', data),
    updateCategory: (id, data) => electron_1.ipcRenderer.invoke('db:updateCategory', id, data),
    // Budgets
    getBudgets: (forDate) => electron_1.ipcRenderer.invoke('db:getBudgets', forDate),
    updateBudget: (id, amount) => electron_1.ipcRenderer.invoke('db:updateBudget', id, amount),
    // Rules
    getCategorisationRules: () => electron_1.ipcRenderer.invoke('db:getRules'),
    addRule: (data) => electron_1.ipcRenderer.invoke('db:addRule', data),
    updateRule: (id, data) => electron_1.ipcRenderer.invoke('db:updateRule', id, data),
    deleteRule: (id) => electron_1.ipcRenderer.invoke('db:deleteRule', id),
    // Dashboard
    getDashboardData: (month) => electron_1.ipcRenderer.invoke('db:getDashboardData', month),
    // Utility
    exportData: () => electron_1.ipcRenderer.invoke('db:exportData'),
    deleteAllData: () => electron_1.ipcRenderer.invoke('db:deleteAllData'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
