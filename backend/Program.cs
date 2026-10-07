using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!));

builder.Services.AddDbContext<AppDb>(o => o.UseSqlite(cfg.GetConnectionString("Default")));
builder.Services.AddAuthentication("Bearer").AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new()
    {
        ValidateIssuer = true, ValidIssuer = cfg["Jwt:Issuer"],
        ValidateAudience = false,
        IssuerSigningKey = key,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        RoleClaimType = "role", NameClaimType = "sub"
    };
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    db.Database.EnsureCreated();
    if (app.Environment.IsDevelopment() && !db.Users.Any())
    {
        db.Users.AddRange(
            new User { FullName = "HR Admin", Email = "admin@leaveapp.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"), Role = "HrAdmin" },
            new User { FullName = "Ali Çalışan", Email = "employee@leaveapp.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Employee123!"), Role = "Employee" });
        db.SaveChanges();
    }
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

static int Uid(ClaimsPrincipal u) => int.Parse(u.FindFirstValue("sub")!);

static int BusinessDays(DateOnly s, DateOnly e)
{
    int n = 0;
    for (var d = s; d <= e; d = d.AddDays(1))
        if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday) n++;
    return n;
}

static object Dto(LeaveRequest r) => new
{
    r.Id, r.UserId, userName = r.User?.FullName, r.LeaveTypeId, leaveType = r.LeaveType?.Name,
    startDate = r.StartDate.ToString("yyyy-MM-dd"), endDate = r.EndDate.ToString("yyyy-MM-dd"),
    r.BusinessDays, r.Description, r.Status, r.RejectionReason, r.CreatedAt, r.DecidedAt
};

static object UserDto(User u) => new { u.Id, u.FullName, u.Email, u.Role, u.IsActive };

static async Task<string?> Validate(LeaveReq q, AppDb db)
{
    if (!DateOnly.TryParse(q.StartDate, out var s) || !DateOnly.TryParse(q.EndDate, out var e)) return "Geçersiz tarih.";
    if (e < s) return "Bitiş tarihi başlangıçtan önce olamaz.";
    if (BusinessDays(s, e) == 0) return "Seçilen aralıkta iş günü yok.";
    if (!await db.LeaveTypes.AnyAsync(t => t.Id == q.LeaveTypeId)) return "Geçersiz izin türü.";
    return null;
}

static void Apply(LeaveRequest r, LeaveReq q)
{
    r.LeaveTypeId = q.LeaveTypeId;
    r.StartDate = DateOnly.Parse(q.StartDate);
    r.EndDate = DateOnly.Parse(q.EndDate);
    r.BusinessDays = BusinessDays(r.StartDate, r.EndDate);
    r.Description = q.Description;
}

// ---- Auth
app.MapPost("/api/auth/login", async (LoginReq req, AppDb db) =>
{
    var u = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email);
    if (u is null || !u.IsActive || !BCrypt.Net.BCrypt.Verify(req.Password, u.PasswordHash))
        return Results.Json(new { error = "Geçersiz e-posta veya şifre." }, statusCode: 401);
    var token = new JwtSecurityToken(cfg["Jwt:Issuer"],
        claims: [new("sub", u.Id.ToString()), new("role", u.Role), new("name", u.FullName)],
        expires: DateTime.UtcNow.AddHours(cfg.GetValue<int>("Jwt:Hours")),
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), user = UserDto(u) });
});

app.MapGet("/api/auth/me", [Authorize] async (ClaimsPrincipal p, AppDb db) =>
{
    var u = await db.Users.FindAsync(Uid(p));
    return u is null || !u.IsActive ? Results.Unauthorized() : Results.Ok(UserDto(u));
});

app.MapGet("/api/leave-types", [Authorize] (AppDb db) => db.LeaveTypes.ToListAsync());

// ---- Employee
var my = app.MapGroup("/api/my/requests").RequireAuthorization();
my.MapGet("/", async (ClaimsPrincipal p, AppDb db) =>
{
    var uid = Uid(p);
    return (await db.LeaveRequests.Include(r => r.LeaveType).Include(r => r.User)
        .Where(r => r.UserId == uid).OrderByDescending(r => r.Id).ToListAsync()).Select(Dto);
});

my.MapPost("/", async (LeaveReq req, ClaimsPrincipal p, AppDb db) =>
{
    var err = await Validate(req, db);
    if (err != null) return Results.BadRequest(new { error = err });
    var r = new LeaveRequest { UserId = Uid(p) };
    Apply(r, req);
    db.LeaveRequests.Add(r);
    await db.SaveChangesAsync();
    return Results.Ok(new { r.Id, r.BusinessDays });
});

my.MapPut("/{id:int}", async (int id, LeaveReq req, ClaimsPrincipal p, AppDb db) =>
{
    var uid = Uid(p);
    var r = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id && x.UserId == uid);
    if (r is null) return Results.NotFound();
    if (r.Status != "Pending") return Results.BadRequest(new { error = "Sadece bekleyen talepler düzenlenebilir." });
    var err = await Validate(req, db);
    if (err != null) return Results.BadRequest(new { error = err });
    Apply(r, req);
    await db.SaveChangesAsync();
    return Results.Ok(new { r.Id, r.BusinessDays });
});

my.MapPost("/{id:int}/cancel", async (int id, ClaimsPrincipal p, AppDb db) =>
{
    var uid = Uid(p);
    var r = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id && x.UserId == uid);
    if (r is null) return Results.NotFound();
    if (r.Status != "Pending") return Results.BadRequest(new { error = "Sadece bekleyen talepler iptal edilebilir." });
    r.Status = "Cancelled";
    await db.SaveChangesAsync();
    return Results.Ok();
});

// ---- HR Admin
var admin = app.MapGroup("/api/admin").RequireAuthorization(p => p.RequireRole("HrAdmin"));

admin.MapGet("/requests", async (string? status, AppDb db) =>
{
    var q = db.LeaveRequests.Include(r => r.LeaveType).Include(r => r.User).AsQueryable();
    if (!string.IsNullOrEmpty(status)) q = q.Where(r => r.Status == status);
    return (await q.OrderByDescending(r => r.Id).ToListAsync()).Select(Dto);
});

admin.MapGet("/requests/{id:int}", async (int id, AppDb db) =>
{
    var r = await db.LeaveRequests.Include(x => x.LeaveType).Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
    return r is null ? Results.NotFound() : Results.Ok(Dto(r));
});

admin.MapPost("/requests/{id:int}/approve", async (int id, ClaimsPrincipal p, AppDb db) =>
{
    var r = await db.LeaveRequests.FindAsync(id);
    if (r is null) return Results.NotFound();
    if (r.Status != "Pending") return Results.BadRequest(new { error = "Talep bekleyen durumda değil." });
    r.Status = "Approved"; r.DecidedAt = DateTime.UtcNow; r.DecidedById = Uid(p);
    await db.SaveChangesAsync();
    return Results.Ok();
});

admin.MapPost("/requests/{id:int}/reject", async (int id, RejectReq req, ClaimsPrincipal p, AppDb db) =>
{
    if (string.IsNullOrWhiteSpace(req.Reason)) return Results.BadRequest(new { error = "Red gerekçesi zorunludur." });
    var r = await db.LeaveRequests.FindAsync(id);
    if (r is null) return Results.NotFound();
    if (r.Status != "Pending") return Results.BadRequest(new { error = "Talep bekleyen durumda değil." });
    r.Status = "Rejected"; r.RejectionReason = req.Reason; r.DecidedAt = DateTime.UtcNow; r.DecidedById = Uid(p);
    await db.SaveChangesAsync();
    return Results.Ok();
});

admin.MapGet("/users", async (AppDb db) => (await db.Users.OrderBy(u => u.Id).ToListAsync()).Select(UserDto));

admin.MapPost("/users", async (CreateUserReq req, AppDb db) =>
{
    if (string.IsNullOrWhiteSpace(req.FullName) || string.IsNullOrWhiteSpace(req.Email) || (req.Password?.Length ?? 0) < 6)
        return Results.BadRequest(new { error = "Ad, e-posta ve en az 6 karakterli şifre zorunludur." });
    if (req.Role is not ("Employee" or "HrAdmin")) return Results.BadRequest(new { error = "Geçersiz rol." });
    if (await db.Users.AnyAsync(u => u.Email == req.Email)) return Results.BadRequest(new { error = "E-posta zaten kayıtlı." });
    var u = new User { FullName = req.FullName, Email = req.Email, Role = req.Role, PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password) };
    db.Users.Add(u);
    await db.SaveChangesAsync();
    return Results.Ok(UserDto(u));
});

app.Run();

record LoginReq(string Email, string Password);
record LeaveReq(int LeaveTypeId, string StartDate, string EndDate, string? Description);
record RejectReq(string? Reason);
record CreateUserReq(string FullName, string Email, string Password, string Role);
