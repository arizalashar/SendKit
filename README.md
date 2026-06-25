# SendKit Platform

SendKit adalah platform middleware pengirim pesan WhatsApp dan Email terintegrasi dengan sistem API Key dan pembatasan pemakaian (rate limiting). Aplikasi ini menjembatani sistem eksternal Anda untuk mengirim pesan cepat dan aman menggunakan Fonnte Gateway (untuk WhatsApp) dan Brevo Gateway (untuk Email/SMTP).

## Fitur Utama

- **Autentikasi User**: Registrasi akun dan Login menggunakan basis JWT (JSON Web Token).
- **Middleware API Key**: Setiap permintaan API diwajibkan menyertakan header `x-api-key`.
- **Rate Limiting**: Pembatasan pemakaian otomatis maksimal 100 request per jam per API Key untuk mencegah spam.
- **Sistem Kuota**: Setiap akun baru secara default memiliki 1.000 kuota pesan yang akan berkurang saat pengiriman sukses.
- **Sistem OTP Terintegrasi**: Endpoint pembuatan OTP 6-digit otomatis dengan batas kedaluwarsa 5 menit serta endpoint verifikasi.
- **Grafik Tren & Riwayat Logs**: Dashboard interaktif yang menampilkan diagram tren pengiriman harian berbasis Chart.js.
- **Konfigurasi Gateway Dinamis**: Admin dapat langsung mengubah token Fonnte dan Brevo melalui UI dashboard secara aman.

---

## Struktur File Proyek

```text
sendkit/
├── server.js
├── .env
├── package.json
├── README.md
├── routes/
│   ├── auth.js
│   ├── api.js
│   └── dashboard.js
├── middleware/
│   ├── authJWT.js
│   └── apiKeyAuth.js
├── controllers/
│   ├── authController.js
│   ├── sendController.js
│   └── dashboardController.js
├── models/
│   ├── db.js
│   └── otpModel.js
└── public/
    ├── index.html
    ├── dashboard.html
    ├── login.html
    ├── register.html
    └── docs.html
```

---

## Variabel Lingkungan (`.env`)

Buat file `.env` di folder root proyek dan lengkapi nilai variabel berikut:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=sendkit
JWT_SECRET=rahasia_jwt_secret_key_sendkit
FONNTE_TOKEN=your_fonnte_token_here
BREVO_API_KEY=your_brevo_api_key_here
```

---

## Panduan Instalasi Lokal

### Prerequisites
- Node.js (v18 ke atas disarankan)
- MySQL Server yang sedang aktif

### Langkah 1: Kloning & Masuk ke Folder Proyek
Masuk ke direktori `sendkit`:
```bash
cd sendkit
```

### Langkah 2: Instalasi Dependensi
Jalankan perintah npm install:
```bash
npm install
```

### Langkah 3: Setup Database
Pastikan server MySQL Anda aktif. Anda tidak perlu mengimpor file SQL secara manual. Aplikasi SendKit dilengkapi fitur **inisialisasi database otomatis**. Server akan mendeteksi dan membuat database `sendkit` beserta seluruh tabel (`users`, `messages_log`, `settings`, `otps`) pada saat server pertama kali dijalankan.

### Langkah 4: Jalankan Aplikasi
Jalankan server dalam mode pengembangan:
```bash
npm run dev
```
Atau jalankan dalam mode production:
```bash
npm start
```
Server akan aktif di `http://localhost:3000`. Buka browser untuk mengakses halaman utama.

> [!NOTE]
> Pengguna pertama yang melakukan registrasi di aplikasi akan secara otomatis mendapatkan peran (role) **`admin`**, sehingga memiliki hak akses untuk mengubah konfigurasi gateway token di halaman Dashboard.

---

## Dokumentasi API Endpoint

Semua endpoint `/api/` wajib menyertakan header berikut:
- `x-api-key`: `API_KEY_ANDA` (dapat disalin dari dashboard)
- `Content-Type`: `application/json`

### 1. Registrasi Akun
* **Endpoint**: `POST /auth/register`
* **Request Body**:
  ```json
  {
    "name": "Developer",
    "email": "dev@email.com",
    "password": "secretpassword"
  }
  ```
* **Response Sukses (201)**:
  ```json
  {
    "success": true,
    "message": "Registrasi akun berhasil.",
    "data": {
      "id": 1,
      "name": "Developer",
      "email": "dev@email.com",
      "api_key": "UUID-API-KEY",
      "quota": 1000,
      "role": "admin"
    }
  }
  ```

### 2. Login Akun
* **Endpoint**: `POST /auth/login`
* **Request Body**:
  ```json
  {
    "email": "dev@email.com",
    "password": "secretpassword"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "Login berhasil.",
    "data": {
      "token": "JWT_TOKEN_STRING",
      "user": { "id": 1, "name": "Developer", "email": "dev@email.com", "role": "admin" }
    }
  }
  ```

### 3. Kirim WhatsApp
* **Endpoint**: `POST /api/send/wa`
* **Request Body**:
  ```json
  {
    "to": "628123456789",
    "message": "Halo dari SendKit API!"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "Pesan WhatsApp berhasil dikirim.",
    "data": { "recipient": "628123456789", "status": "sent" }
  }
  ```

### 4. Kirim Email
* **Endpoint**: `POST /api/send/email`
* **Request Body**:
  ```json
  {
    "to": "penerima@email.com",
    "subject": "Judul Email",
    "message": "<h3>Isi Email HTML</h3><p>Ini contoh pengiriman email.</p>"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "Email berhasil dikirim.",
    "data": { "recipient": "penerima@email.com", "status": "sent" }
  }
  ```

### 5. Kirim OTP WhatsApp
* **Endpoint**: `POST /api/send/otp/wa`
* **Request Body**:
  ```json
  {
    "to": "628123456789"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "OTP berhasil dikirim via WhatsApp.",
    "data": { "recipient": "628123456789" }
  }
  ```

### 6. Kirim OTP Email
* **Endpoint**: `POST /api/send/otp/email`
* **Request Body**:
  ```json
  {
    "to": "penerima@email.com"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "OTP berhasil dikirim via Email.",
    "data": { "recipient": "penerima@email.com" }
  }
  ```

### 7. Verifikasi Kode OTP
* **Endpoint**: `POST /api/verify/otp`
* **Request Body**:
  ```json
  {
    "to": "628123456789",
    "otp": "123456"
  }
  ```
* **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "message": "Verifikasi OTP berhasil. Kode valid.",
    "data": { "verified": true }
  }
  ```

---

## Lisensi

Proyek ini dilisensikan di bawah **MIT License**. Anda bebas menggunakan, memodifikasi, dan menyebarkan kode ini untuk kebutuhan pribadi maupun komersial.
