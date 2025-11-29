# 🚀 Quick Start Guide

## Running the Application

### Option 1: Single Command (Easiest!)
Run both backend and frontend together:
```bash
npm run dev:all
```

Then open your browser to: **http://localhost:5173**

---

### Option 2: Separate Terminals (For Debugging)

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Then open your browser to: **http://localhost:5173**

---

## 🔐 Encryption Keys - Automatic Setup

**No configuration needed!** 

On first run, the application will automatically:
1. ✅ Generate secure encryption keys (64-128 character random strings)
2. ✅ Save them to: `~/.funds_management_keys/encryption_keys.json`
3. ✅ Set read-only permissions (chmod 400) for security
4. ✅ Load and use them automatically

### Keys Location:
```bash
# View your generated keys (KEEP THESE SECRET!)
cat ~/.funds_management_keys/encryption_keys.json
```

### Backup Your Keys (Important!)
```bash
# Backup to a secure location
cp ~/.funds_management_keys/encryption_keys.json ~/secure_backup/
```

⚠️ **Warning:** If you lose these keys, all encrypted credentials will be unrecoverable!

---

## 📋 First-Time Setup Steps

1. **Start the application:**
   ```bash
   npm run dev:all
   ```

2. **Wait for both servers to start:**
   - Backend: `http://localhost:3000` 
   - Frontend: `http://localhost:5173`
   - Swagger API: `http://localhost:3000/api-docs`

3. **Open your browser** to `http://localhost:5173`

4. **Create an account:**
   - Click "Sign Up" tab
   - Enter username and password
   - Click "Sign Up"

5. **Add your first bank account:**
   - Go to "Accounts" tab
   - Click "Add Account"
   - Select your bank/credit card
   - Enter account details and credentials
   - Click "Add Account"

6. **View real-time logs:**
   - Go to "Logs" tab
   - Toggle "Real-time Updates" ON
   - See all actions logged in real-time!

---

## 🎯 What You'll See

### Home Dashboard
- Net income, expenses, cash flow cards
- Time period filters (last month, 3/6/12 months, custom)
- Pie chart of expenses by category
- Line chart showing income vs expenses trends
- Top 5 recurring payments

### Accounts
- All your configured accounts
- Bank vs Credit Card icons
- Active/Inactive status
- Add/Edit/Delete functionality

### Logs
- Real-time application logs (updates every 3 seconds)
- Filter by level (Info, Warning, Error, Debug)
- Search by message or context
- See every action instantly!

---

## 🔧 Configuration (Optional)

If you want to customize settings, create `config/config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "env": "development"
  },
  "database": {
    "path": "./data/funds_management.db",
    "enableWAL": true,
    "enableForeignKeys": true
  },
  "logging": {
    "level": "info",
    "filePath": "./logs",
    "console": true,
    "file": true
  },
  "scraping": {
    "screenshotPath": "./screenshots"
  }
}
```

**Note:** You don't need to specify encryption keys - they're auto-generated!

---

## 🛑 Stopping the Application

Press `Ctrl+C` in the terminal to stop both servers.

---

## 📊 Ports Used

- **Backend API:** 3000
- **Frontend:** 5173
- **Swagger Docs:** 3000/api-docs

---

## 🆘 Troubleshooting

### Port Already in Use?
```bash
# Check what's using the port
lsof -ti:3000
lsof -ti:5173

# Kill the process
kill -9 <PID>
```

### Need to Reset?
```bash
# Delete database (will lose data!)
rm -rf data/funds_management.db

# Regenerate keys
rm -rf ~/.funds_management_keys
```

---

## 🎉 You're Ready!

The application is now running with:
- ✅ Auto-generated secure encryption keys
- ✅ Real-time logging
- ✅ Modern fintech dashboard
- ✅ Full CRUD for accounts
- ✅ Analytics and visualizations

Enjoy your Israeli Funds Management application!