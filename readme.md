# Veu Unlimited — Complete Setup Guide

## 🚀 How to Start

### Step 1: Start Server
```
Double-click: D:\Script\VeuUnlimited\START.bat
OR
PowerShell: node D:\Script\VeuUnlimited\extension\dev-server.js
```

Server starts at: **http://localhost:8090**

### Step 2: Admin Panel
```
Open: http://localhost:8090
Admin Key: veu-admin-2026
```

### Step 3: Extension Setup (for users)
```
chrome://extensions → Developer Mode ON → Load unpacked
→ Select: D:\Script\VeuUnlimited\extension
```

---

## 📊 Login Accounts

| Email | Password | Plan | Credits | Daily Limit | Expiry |
|-------|----------|------|---------|-------------|--------|
| admin@veu.unlimited | admin007 | ultra (all models) | Unlimited | Unlimited | Never |
| demo@veu.unlimited | demo123 | ultra (all models) | 500 | 50/day | 30 days |

---

## 🔧 Admin Panel — Features

| Feature | Description |
|---------|-------------|
| **Create User** | Email, password, credit limit, daily limit, expiry days |
| **Bulk Generate** | Create 1-100 users at once, download .txt |
| **Edit User** | Change credits, plan, expiry |
| **Reset Credits** | Reset used credits to 0 |
| **Disable/Enable** | Block or unblock users |
| **Delete User** | Remove user permanently |
| **Credit Ledger** | Every deduction logged |
| **Global Cookies** | Update Google Flow session cookies |

---

## 🎯 How It Works

1. Admin creates user with credit limit + expiry
2. User receives extension + email/password
3. User installs extension → logs in
4. Extension auto-injects Google Flow cookies
5. User goes to `labs.google/fx/tools/flow`
6. **All models unlocked** (Veo, Omni, Flash) with plan=ultra
7. Each video generation deducts credits
8. When credits=0 or time expired → blocked
9. Admin can reset credits or extend time

---

## 🛠️ Sell as Subscription

| Plan | Credits | Price (you set) |
|------|---------|-----------------|
| Weekly | 100 | ? BDT |
| Monthly | 500 | ? BDT |
| Pro Monthly | 2000 | ? BDT |
| Unlimited | ∞ | ? BDT |

---

## 📁 Files

| File | Purpose |
|------|---------|
| `START.bat` | One-click server start |
| `extension/dev-server.js` | Full API server |
| `extension/` folder | Chrome extension (give to users) |
| `veu-data/db.json` | User database |
| `README.md` | This guide |
