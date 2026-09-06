# LoveNest

Aplikasi privat untuk dua orang: satu akun cewek, satu akun cowok. Next.js 14 (App Router) + Supabase, siap deploy ke Vercel.

Warna utama `#FF8DA1`, mode terang & gelap.

## Isi fitur

| Menu | Yang bisa dilakukan |
|---|---|
| Beranda | Penghitung hari sejak 19 Juni 2026 (tahun/bulan/hari + jam:menit:detik), hitung mundur monthsary, ringkasan siklus, moment terbaru |
| Chat | Realtime gaya iOS Messenger, foto (otomatis dikompres), voice note, balas pesan, reaksi ❤️, hapus, status "dibaca", indikator sedang mengetik |
| Panggilan | Voice call dan video call WebRTC, mute, matikan kamera, ganti kamera depan/belakang, riwayat panggilan masuk ke chat |
| Kalender | Kalender bersama + agenda; pencatatan dan prediksi haid (mulai, selesai, rata-rata siklus, masa subur, ovulasi). Pencatatan hanya bisa dari akun cewek, cowok bisa melihat |
| Moment | Galeri foto, unggah banyak sekaligus, kompresi di browser, caption, hapus, info penghematan ukuran |
| Main | Ular Tangga Bucin (realtime cewek vs cowok, dengan kotak tantangan) dan Tebak Gambar (kanvas realtime, satu menggambar satu menebak) |
| Profil | Ubah nama panggilan, foto profil, status singkat, tanggal jadian, tema, keluar |

---

## Cara pasang

Baca `MULAI-DISINI.md`. Ringkasnya:

1. Jalankan `supabase/schema.sql` di Supabase → SQL Editor.
2. Tempel Project URL dan anon key ke `src/lib/config.ts`.
3. Push ke repo **privat**, lalu import di Vercel dan Deploy.

Tidak ada Environment Variable yang wajib diisi. Semua pengaturan ada di dua file:

| File | Isi | Ikut ke browser? |
|---|---|---|
| `src/lib/config.ts` | URL Supabase, anon key, nama awal, tanggal jadian | Ya |
| `src/lib/config.server.ts` | Kode login cewek & cowok, `AUTH_SECRET` | Tidak, hanya dibaca server |

`AUTH_SECRET` sudah diisi kunci acak. Kode login bawaan `sayangku` (cewek) dan
`sayangmu` (cowok) — ganti dengan milik kalian.

Kalau nanti kamu ingin memindahkan rahasianya keluar dari kode, isi
`GIRL_LOGIN_CODE`, `BOY_LOGIN_CODE`, `AUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di Vercel → Settings → Environment
Variables. Nilai di sana selalu menang atas isi file config.

## Jalankan di komputer

```bash
npm install
npm run dev
```

---

## Cara kerja login

Halaman depan menampilkan dua akun: cewek dan cowok. Pilih salah satu, masukkan kode, lalu server membandingkannya dengan isi `config.server.ts`. Kalau cocok, server memberi cookie sesi bertanda tangan (JWT, `httpOnly`, berlaku 180 hari) dan `middleware.ts` menjaga semua halaman lain.

Tidak ada pendaftaran. Mau ganti kode? Ubah `config.server.ts` lalu push, atau isi environment variable di Vercel lalu redeploy.

## Cara kerja kompresi foto

Ada di `src/lib/compress.ts`. Foto dikecilkan di browser sebelum diunggah:

- resolusi dipertahankan tinggi (sisi terpanjang 2000px untuk galeri, 1600px untuk chat), jadi foto HP biasanya tidak diturunkan sama sekali
- format WebP kualitas 0.92, ukuran turun 70–90% tanpa perbedaan yang terlihat mata
- kalau masih di atas target, kualitas diturunkan bertahap dan **berhenti di 0.72** supaya tidak muncul artefak
- pengecilan ukuran dilakukan bertahap 2x dengan `imageSmoothingQuality: 'high'` supaya hasilnya tajam, bukan pecah
- kalau hasilnya malah lebih besar dari aslinya, file asli yang dipakai

Halaman Moment menampilkan total penghematannya.

## Catatan tentang panggilan

Panggilan memakai WebRTC langsung antar-perangkat; Supabase Realtime hanya dipakai untuk bertukar sinyal. Server STUN Google sudah disetel dan cukup untuk sebagian besar jaringan rumah dan seluler.

Kalau salah satu berada di jaringan kantor atau kampus yang ketat, sambungan bisa gagal. Tambahkan TURN server di `ICE.iceServers` dalam `src/components/CallProvider.tsx` (misalnya lewat Metered, Twilio, atau coturn sendiri).

Browser hanya mengizinkan mikrofon dan kamera lewat HTTPS. Di Vercel ini otomatis; di lokal pakai `localhost` (juga dianggap aman).

## Catatan keamanan

Aplikasi ini dirancang untuk dua orang yang saling percaya. Row Level Security aktif tapi policy-nya permisif, sehingga anon key bisa membaca dan menulis semua tabel. Yang menjaga pintunya adalah kode login di sisi server.

Karena kode login ikut tersimpan di dalam repo, **repo-nya harus privat**. Kalau repo publik, siapa pun bisa membaca kodenya dan memalsukan cookie sesi.

Kalau kamu ingin lebih ketat, pindahkan operasi tulis ke Route Handler yang memakai service role key, lalu perketat policy Supabase menjadi read-only untuk anon.

## Struktur

```
src/
  app/
    page.tsx              daftar login
    (app)/                halaman yang butuh sesi
      home  chat  calendar  moments  games  profile
    api/auth/             login & logout
  components/             UI dan logika fitur
  lib/
    config.ts             ← isi Supabase di sini
    config.server.ts      ← kode login di sini
    auth, supabase, kompresi, hitung siklus
  middleware.ts           penjaga rute
supabase/schema.sql       jalankan sekali di Supabase
```
# kiki
