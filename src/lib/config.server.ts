/* ============================================================================
 *  Kode login dan kunci sesi.
 *
 *  File ini HANYA dibaca di server (middleware dan route login). Isinya tidak
 *  pernah ikut ke browser, jadi aman selama repo kamu privat.
 *
 *  Ganti dua kode di bawah dengan kata rahasia kalian berdua.
 * ========================================================================== */

export const GIRL_LOGIN_CODE = 'nadya123'
export const BOY_LOGIN_CODE = 'nadya666'

/**
 * Kunci untuk menandatangani cookie sesi. Sudah diacak, tidak perlu diganti.
 * Kalau nilainya diubah, semua sesi yang sedang berjalan ikut logout.
 */
export const AUTH_SECRET = '6nWL9l8XLTOZJRiP9IAaMKA/nZh5J+Fcf5/s/ui1sVfVstotLp2Tf+Wp57pewAPb'

export const SERVER_CONFIG = {
  girlCode: process.env.GIRL_LOGIN_CODE || GIRL_LOGIN_CODE,
  boyCode: process.env.BOY_LOGIN_CODE || BOY_LOGIN_CODE,
  authSecret: process.env.AUTH_SECRET || AUTH_SECRET,
}
