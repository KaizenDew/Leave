using Microsoft.EntityFrameworkCore;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "Employee"; // Employee | HrAdmin
    public bool IsActive { get; set; } = true;
}

public class LeaveType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
}

public class LeaveRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int LeaveTypeId { get; set; }
    public LeaveType? LeaveType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int BusinessDays { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending"; // Pending | Approved | Rejected | Cancelled
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAt { get; set; }
    public int? DecidedById { get; set; }
}

public class AppDb(DbContextOptions<AppDb> o) : DbContext(o)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<LeaveType>().HasIndex(t => t.Code).IsUnique();
        b.Entity<LeaveType>().HasData(
            new LeaveType { Id = 1, Name = "Yıllık İzin", Code = "ANNUAL" },
            new LeaveType { Id = 2, Name = "Hastalık İzni", Code = "SICK" },
            new LeaveType { Id = 3, Name = "Mazeret İzni", Code = "EXCUSE" },
            new LeaveType { Id = 4, Name = "Ücretsiz İzin", Code = "UNPAID" },
            new LeaveType { Id = 5, Name = "Ölüm İzni", Code = "BEREAVEMENT" });

    }
}
