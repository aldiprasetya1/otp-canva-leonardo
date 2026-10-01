# OTP LEONARDO - Web Mirror

Aplikasi Web Mirror untuk menerima dan memantau kode verifikasi (OTP) Leonardo AI & Canva secara instan.

Dibuat khusus untuk folder **Rahmat Premium**.

---

## 🚀 Fitur Utama

- **Antarmuka Modern Bertema Leonardo AI**: Tampilan gelap (*dark mode*) yang bersih, responsif di HP maupun PC.
- **Auto CSRF Handshake**: Otomatis menangani CSRF Token dan Session Cookie dari server sumber di sisi backend.
- **Zero External Dependencies**: Menggunakan library bawaan Node.js (tanpa perlu repot `npm install`).
- **Auto Port Fallback**: Otomatis mendeteksi port yang tersedia mulai dari port 8080.
- **Salin Sekali Klik**: Tombol salin kode OTP langsung ke clipboard dengan konfirmasi visual.
- **Auto-Refresh dengan Countdown**: Fitur perbarui otomatis setiap 15 detik saat menunggu OTP masuk.
- **Suara Notifikasi**: Notifikasi suara otomatis berbunyi ketika ada kode OTP baru yang masuk.
- **Riwayat Pencarian**: Menyimpan riwayat email yang baru dicari di browser untuk kemudahan akses cepat.
- **Endpoint API (GET & POST)**: Siap diintegrasikan langsung ke bot Telegram atau script otomatis lainnya di folder Rahmat Premium.

---

## 📂 Struktur File

```
F:\6. RAHMAT PREMIUM\OTP MIRROR\
│
├── server.js            # Backend Server Node.js (Proxy & API)
├── package.json         # Konfigurasi project
├── START_WEB.bat        # File shortcut Windows (Klik 2x langsung jalan)
├── README.md            # Dokumentasi panduan
└── public/
    └── index.html       # Antarmuka Web "OTP LEONARDO"
```

---

## 💻 Cara Menjalankan

### Cara 1 (Paling Mudah)
Cukup **klik dua kali** file:
👉 `START_WEB.bat`

Browser akan otomatis terbuka menampilkan web **OTP LEONARDO**.

### Cara 2 (Lewat Terminal / CMD)
Buka terminal di folder ini, lalu jalankan:
```bash
node server.js --open
```

---

## 📡 Integrasi API untuk Script / Bot Lain

Aplikasi ini juga menyediakan endpoint lokal yang bisa Anda panggil langsung dari bot Telegram atau script lain:

### 1. Metode GET (Sangat mudah untuk Bot)
```http
GET http://localhost:8080/api/get-otp?email=contoh@domain.com
```

### 2. Metode POST (JSON)
```http
POST http://localhost:8080/api/get-otp
Content-Type: application/json

{
  "email": "contoh@domain.com"
}
```

### Contoh Format Response:
```json
{
  "ok": true,
  "email": "contoh@domain.com",
  "otps": [
    {
      "subject": "Your Leonardo AI verification code: 654321",
      "otp": "654321",
      "ts": 1727680000000
    }
  ]
}
```
