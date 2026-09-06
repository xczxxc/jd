# Mulai di sini

Tiga menit, dua langkah.

## 1. Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).
2. Menu **SQL Editor** → **New query** → tempel seluruh isi `supabase/schema.sql` → **Run**.
   Sekali jalan, semua tabel dan folder penyimpanan foto langsung jadi.
3. Menu **Project Settings → API**, salin dua nilai ini:
   - **Project URL**
   - **anon public** key (yang panjang, bukan `service_role`)

## 2. Tempel ke satu file

Buka `src/lib/config.ts`, ganti dua baris paling atas:

```ts
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...'
```

Selesai. Sisanya sudah terisi.

## Kode login

Ada di `src/lib/config.server.ts`. Sekarang isinya:

| Akun  | Kode       |
|-------|------------|
| Cewek | `sayangku` |
| Cowok | `sayangmu` |

Ganti dengan kata rahasia kalian sendiri. `AUTH_SECRET` di file yang sama sudah
diisi kunci acak, tidak perlu disentuh.

## Deploy ke Vercel

Repo-nya **wajib privat**, karena kode login ikut tersimpan di dalamnya.

```bash
git init
git add .
git commit -m "LoveNest"
git remote add origin <url-repo-privat-kamu>
git push -u origin main
```

Lalu di Vercel: **Add New → Project → Import** repo tadi → **Deploy**.
Tidak ada Environment Variables yang perlu diisi. Framework terdeteksi otomatis,
build setting jangan diubah.

Tanpa GitHub juga bisa, dari dalam folder:

```bash
npx vercel --prod
```

## Coba dulu di komputer

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`, login sebagai cewek di satu tab dan cowok di tab
penyamaran, biar bisa lihat chat dan game-nya jalan berdua.

## Kalau nanti ingin lebih rapi

Kode login di dalam repo itu praktis tapi bukan yang paling aman. Kapan pun kamu
mau memindahkannya, isi `GIRL_LOGIN_CODE`, `BOY_LOGIN_CODE`, dan `AUTH_SECRET`
di **Vercel → Settings → Environment Variables**, lalu Redeploy. Nilai di sana
otomatis menang, dan isi `config.server.ts` diabaikan.
