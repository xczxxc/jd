/* ============================================================================
 *  ISI BAGIAN INI SAJA — tidak perlu menyentuh file lain.
 *
 *  Cuma dua baris pertama yang wajib kamu ganti (dari Supabase → Settings →
 *  API). Sisanya sudah terisi dan boleh dibiarkan.
 *
 *  Catatan: file ini ikut terkirim ke browser, jadi jangan menaruh kode login
 *  atau kunci rahasia di sini. Itu tempatnya di config.server.ts.
 * ========================================================================== */

export const SUPABASE_URL = 'https://qedwttihbumcibaojhmj.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZHd0dGloYnVtY2liYW9qaG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDg2MjYsImV4cCI6MjEwNDAyNDYyNn0.hUpFXG5xuqf4luUjuLyP-Xzi3KGCwjCXHkLuL_1vRT0'

/** Tanggal jadian. Bisa juga diubah nanti lewat menu Profil. */
export const LOVE_START_DATE = '2026-06-19'

/** Nama awal, sebelum kalian menggantinya sendiri di menu Profil. */
export const BOY_NAME = 'Muhammad Ilhan'
export const GIRL_NAME = 'Anindya Ayu Agustine'

/* -------------------------------------------------------------------------
 *  Di bawah ini tidak perlu diubah.
 *  Kalau kamu lebih suka memakai Environment Variables di Vercel, isi saja
 *  NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di sana —
 *  nilainya otomatis menang atas yang di atas.
 * ----------------------------------------------------------------------- */

export const CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  loveStartDate: process.env.NEXT_PUBLIC_LOVE_START_DATE || LOVE_START_DATE,
  boyName: process.env.NEXT_PUBLIC_BOY_NAME || BOY_NAME,
  girlName: process.env.NEXT_PUBLIC_GIRL_NAME || GIRL_NAME,
}

export const isSupabaseConfigured = !CONFIG.supabaseUrl.includes('GANTI')
