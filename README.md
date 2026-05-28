# Absensi Wali Kelas SD - Cloudflare Pages + D1

## Login demo
Username: `1a` sampai `6b`  
Password: `123456`

## Langkah pakai
1. Buat database **D1**.
2. Jalankan `schema.sql`.
3. Deploy folder ini ke **Cloudflare Pages**.
4. Tambahkan binding database dengan nama: `DB`.
5. Jalankan `POST /api/seed` satu kali untuk membuat akun demo.
6. Login memakai akun demo di atas.

## Import siswa
Masuk tab **Siswa**, lalu tempel data format:
```text
nisn,nama,nomor
3136899923,REVAL RESTU MAULANA,1
3141104224,NAMA LAIN,2
```

## Isi folder
- `public/` = web
- `functions/` = API
- `schema.sql` = struktur database
- `seed.sql` = seed kelas
