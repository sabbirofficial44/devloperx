# Veu Unlimited — Setup Guide

## ✅ Already Done

- পুরো flowaiivideo থেকে কপি করে **Veu Unlimited** হিসেবে রিব্র্যান্ড করা হয়েছে
- Extension: "Veu Unlimited — Google Flow Access" v1.0.0
- Web App: সব পেজে "Veu Unlimited" branding
- Dev server চলছে: `http://localhost:8082` (frontend 100% OK)
- সমস্ত 427 npm packages installed
- `.env.example` template তৈরি

## ❌ যা করা বাকি (1 step)

**SUPABASE_SERVICE_ROLE_KEY** দরকার। এটা .env ফাইলে নেই কারণ Lovable Cloud auto-inject করে।

## 🚀 Setup Steps

### Step 1: Supabase Project

1. `https://supabase.com` → Sign Up
2. New Project → `veu-unlimited`
3. Region: **Singapore (ap-southeast-1)**
4. Database password set করো

### Step 2: Keys

Supabase Dashboard → Settings → **Data API**:

```
Project URL:    https://XXXX.supabase.co
anon key:       eyJhbG... (publishable)
service_role:   eyJhbG... (secret — এটাই দরকার)
```

### Step 3: .env

`D:\Script\VeuUnlimited\.env`:

```env
SUPABASE_URL="https://XXXX.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..." ← service_role key
SUPABASE_PUBLISHABLE_KEY="eyJhbG..."  ← anon/public key
VITE_SUPABASE_URL="https://XXXX.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbG..."
```

### Step 4: Database Migrations

Supabase SQL Editor-এ এই 10 টা SQL file **order অনুযায়ী** run করো:

1. `supabase/migrations/20260716154924_...sql`
2. `supabase/migrations/20260716155202_...sql`
3. `supabase/migrations/20260716155218_...sql`
4. `supabase/migrations/20260716165743_...sql`
5. `supabase/migrations/20260717013510_...sql`
6. `supabase/migrations/20260717020311_...sql`
7. `supabase/migrations/20260717104746_...sql`
8. `supabase/migrations/20260717111058_...sql`
9. `supabase/migrations/20260717111203_...sql`
10. `supabase/migrations/20260718062552_...sql`

### Step 5: Run

```powershell
cd D:\Script\VeuUnlimited
bun install
bun dev
```

খুলবে: `http://localhost:3000`

### Step 6: First Admin

SQL Editor:

```sql
-- Signup করার পর user_id নাও, তারপর:
INSERT INTO user_roles (user_id, role)
VALUES ('USER_UUID', 'admin');
```

### Step 7: Cookies Upload

Chrome → Google Flow login → DevTools → Application → Cookies → copy → Admin → Activate Cookies

### Step 8: Extension

`chrome://extensions` → Developer Mode → Load Unpacked → `D:\Script\VeuUnlimited\extension`

---

## Database Tables (migration creates)

| Table | Purpose |
|-------|---------|
| profiles | Users + credits + assigned_cookies |
| user_roles | Admin/User roles |
| session_cookies | Google Flow session cookies |
| credit_ledger | Credit deduction history |
| admin_created_users | Admin-created account log |

---

## API Endpoints

| Endpoint | Method | Auth |
|----------|--------|------|
| /api/public/auth/login | POST | Public |
| /api/public/extension/verify | POST | Public |
| /api/public/extension/generate | POST | Public |
| /api/public/extension/deduct | POST | Public |

---

## Project Structure

```
D:\Script\VeuUnlimited\
├── extension/          → Chrome Extension
├── src/
│   ├── routes/api/public/  → API endpoints
│   ├── routes/_authenticated/admin.tsx  → Admin Panel
│   ├── routes/_authenticated/dashboard.tsx → User Dashboard
│   └── lib/flow-admin.functions.ts → Admin functions
├── supabase/migrations/  → 10 SQL migration files
└── .env.example          → Template
```
