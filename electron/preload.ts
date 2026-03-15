import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // File dialog
  openFileDialog: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:openFile'),

  // Parsing
  parseCSVFile: (filePath: string) =>
    ipcRenderer.invoke('csv:parse', filePath),

  // Accounts
  getAccounts: () =>
    ipcRenderer.invoke('db:getAccounts'),

  // Import
  importTransactions: (data: unknown) =>
    ipcRenderer.invoke('db:importTransactions', data),
  getImportHistory: () =>
    ipcRenderer.invoke('db:getImportHistory'),

  // Transactions
  getTransactions: (filters?: unknown) =>
    ipcRenderer.invoke('db:getTransactions', filters),
  updateTransaction: (id: number, updates: unknown) =>
    ipcRenderer.invoke('db:updateTransaction', id, updates),

  // Categories
  getCategories: () =>
    ipcRenderer.invoke('db:getCategories'),
  addCategory: (data: unknown) =>
    ipcRenderer.invoke('db:addCategory', data),
  updateCategory: (id: number, data: unknown) =>
    ipcRenderer.invoke('db:updateCategory', id, data),

  // Budgets
  getBudgets: (forDate?: string) =>
    ipcRenderer.invoke('db:getBudgets', forDate),
  updateBudget: (id: number, amount: number) =>
    ipcRenderer.invoke('db:updateBudget', id, amount),

  // Rules
  getCategorisationRules: () =>
    ipcRenderer.invoke('db:getRules'),
  addRule: (data: unknown) =>
    ipcRenderer.invoke('db:addRule', data),
  deleteRule: (id: number) =>
    ipcRenderer.invoke('db:deleteRule', id),

  // Dashboard
  getDashboardData: (month: string) =>
    ipcRenderer.invoke('db:getDashboardData', month),

  // Utility
  exportData: (): Promise<string> =>
    ipcRenderer.invoke('db:exportData'),
  deleteAllData: () =>
    ipcRenderer.invoke('db:deleteAllData'),
}

contextBridge.exposeInMainWorld('electronAPI', api)
