# LeaveApp

Çalışanların izin süreçlerini dijital olarak yönettiği HR / izin yönetim web uygulaması.

| Katman | Teknoloji |
|---|---|
| Backend | .NET 10 Web API (Minimal API), EF Core + SQLite, JWT, BCrypt |
| Frontend | React + TypeScript + Vite |

## Klasör yapısı

```
LeaveApp/
├── backend/    # .NET 10 Web API (Api.csproj, Program.cs, Models.cs)
└── frontend/   # React + TypeScript + Vite
```

## Gereksinimler

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (LTS) ve npm

## Portlar

| Servis | Adres |
|---|---|
| Backend API | http://localhost:5080 |
| Frontend (Vite) | http://localhost:5173 |

Backend CORS ayarı yalnızca `http://localhost:5173` adresine izin verir; frontend'i farklı portta çalıştırırsanız `backend/Program.cs` içindeki CORS ayarı da güncellenmelidir.

## 1. Backend'i çalıştırma

### JWT anahtarını tanımlama (ilk kurulumda bir kez)

JWT imza anahtarı repoda **tutulmaz**. Her geliştirici kendi makinesinde user-secrets ile tanımlar. Anahtar en az 32 karakter olmalıdır.

PowerShell ile rastgele anahtar üretip kaydetmek için:

```powershell
cd backend
$b = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
dotnet user-secrets set "Jwt:Key" ([Convert]::ToBase64String($b))
```

Kontrol: `dotnet user-secrets list`

> Anahtar tanımlı değilse uygulama açılışta `Value cannot be null (Parameter 's')` hatasıyla durur. Bu hatayı görürseniz yukarıdaki adımı uygulayın.

Production ortamında anahtar ortam değişkeniyle verilir (çift alt çizgi, `:` yerine):

```
Jwt__Key=<en az 32 karakterlik gizli anahtar>
```

### Çalıştırma

```powershell
cd backend
dotnet run
```

- API `http://localhost:5080` adresinde açılır (`Properties/launchSettings.json`, Development ortamı).
- SQLite veritabanı `backend/leaveapp.db` dosyasına ilk çalıştırmada otomatik oluşturulur (`EnsureCreated`).
- Veritabanını sıfırlamak için uygulamayı durdurup `leaveapp.db`, `leaveapp.db-shm` ve `leaveapp.db-wal` dosyalarını silin.

## 2. Frontend'i çalıştırma

```powershell
cd frontend
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır.

API adresi `frontend/.env.development` içindeki `VITE_API_URL` değişkeninden okunur:

```
VITE_API_URL=http://localhost:5080/api
```

Production build için aynı değişken build sırasında verilmelidir (ör. `.env.production`).

Diğer komutlar: `npm run build` (derleme), `npm run lint` (oxlint), `npm run preview`.

## Seed (başlangıç) hesapları

Veritabanı boşken backend ilk açılışta şu iki kullanıcıyı oluşturur:

| Rol | E-posta | Şifre |
|---|---|---|
| HrAdmin | admin@leaveapp.com | Admin123! |
| Employee | employee@leaveapp.com | Employee123! |

> **Uyarı:** Bu hesaplar yalnızca geliştirme içindir. Şu anda seed her ortamda çalışmaktadır; yalnızca Development ortamına sınırlanması planlıdır (Aşama 0, T0.4). Gerçek bir ortama çıkmadan önce bu hesaplar kullanılmamalıdır.

İzin türleri (Yıllık, Hastalık, Mazeret, Ücretsiz İzin) veritabanı oluşturulurken otomatik eklenir.

## Roller

- **Employee:** giriş yapar, izin talebi oluşturur / düzenler / iptal eder, kendi taleplerini görür.
- **HrAdmin:** tüm talepleri görür, bekleyen talepleri onaylar veya reddeder (red gerekçesi zorunlu), kullanıcı listeler ve oluşturur.

## Geliştirme kuralları

- Her task bağımsız yapılır; task kapsamı dışındaki dosyalara dokunulmaz.
- Gizli bilgiler (JWT anahtarı, şifreler) repoya girmez.
- Hata çıktığında önce kök neden belirlenir, sonra düzeltilir.
