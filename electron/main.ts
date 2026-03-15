import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'
import { createSchema } from './database/schema'
import { seedDatabase } from './database/seed'
import { setDb } from './database/queries'
import * as Q from './database/queries'
import { parseCSVFile } from './parsers/index'

const isDev = process.env.NODE_ENV === 'development'

// ── Database setup ────────────────────────────────────────────────────────────

function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'budgetlens.db')
  const db = new Database(dbPath)
  createSchema(db)
  seedDatabase(db)
  setDb(db)
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
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
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })
    return result.filePaths
  })

  ipcMain.handle('csv:parse', (_e, filePath: string) => {
    return parseCSVFile(filePath)
  })

  ipcMain.handle('db:getAccounts', () => Q.getAccounts())

  ipcMain.handle('db:addAccount', (_e, data) => Q.addAccount(data))

  ipcMain.handle('db:updateAccount', (_e, id: number, data) => Q.updateAccount(id, data))

  ipcMain.handle('db:detectTransfers', (_e, windowDays: number) => Q.detectTransfers(windowDays))

  ipcMain.handle('db:applyTransfers', (_e, txIds: number[]) => Q.applyTransfers(txIds))

  ipcMain.handle('db:toggleTransfer', (_e, id: number) => Q.toggleTransfer(id))

  ipcMain.handle('db:importTransactions', (_e, data) => Q.importTransactions(data))

  ipcMain.handle('db:getImportHistory', () => Q.getImportHistory())

  ipcMain.handle('db:getTransactions', (_e, filters) => Q.getTransactions(filters ?? {}))

  ipcMain.handle('db:updateTransaction', (_e, id: number, updates) => {
    Q.updateTransaction(id, updates)
  })

  ipcMain.handle('db:getCategories', () => Q.getCategories())

  ipcMain.handle('db:addCategory', (_e, data) => Q.addCategory(data))

  ipcMain.handle('db:updateCategory', (_e, id: number, data) => Q.updateCategory(id, data))

  ipcMain.handle('db:deleteCategory', (_e, id: number) => Q.deleteCategory(id))

  ipcMain.handle('db:getSavingsHistory', () => Q.getSavingsHistory())

  ipcMain.handle('db:getBudgets', (_e, forDate?: string) => Q.getBudgets(forDate))

  ipcMain.handle('db:updateBudget', (_e, id: number, amount: number) => Q.updateBudget(id, amount))

  ipcMain.handle('db:getRules', () => Q.getCategorisationRules())

  ipcMain.handle('db:addRule', (_e, data) => Q.addRule(data))

  ipcMain.handle('db:updateRule', (_e, id: number, data) => Q.updateRule(id, data))

  ipcMain.handle('db:deleteRule', (_e, id: number) => Q.deleteRule(id))

  ipcMain.handle('db:getDashboardData', (_e, month: string) => Q.getDashboardData(month))

  ipcMain.handle('db:exportData', async () => {
    const csv = Q.exportAllData()
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `budgetlens-export-${new Date().toISOString().slice(0,10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (filePath) {
      fs.writeFileSync(filePath, csv, 'utf8')
      shell.showItemInFolder(filePath)
    }
    return csv
  })

  ipcMain.handle('db:deleteAllData', () => Q.deleteAllData())
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
