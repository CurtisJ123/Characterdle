using Characterdle.Server.Features.UniverseGames;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Add services to the container.

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var supabaseConnectionString = builder.Configuration.GetConnectionString("Supabase");

if (string.IsNullOrWhiteSpace(supabaseConnectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Supabase' is not configured. Set it with dotnet user-secrets for local development.");
}

builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(supabaseConnectionString));
builder.Services.AddSingleton(UniverseCatalog.CreateDefault());
builder.Services.AddScoped<IUniverseGameRepository, SupabaseUniverseGameRepository>();
builder.Services.AddHostedService<UniverseGameScheduleService>();

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

//app.UseHttpsRedirection();

app.MapGet("/api/status", () => Results.Ok(new
{
    name = "Characterdle",
    status = "Ready"
}));
app.MapUniverseGameEndpoints();

app.MapFallbackToFile("/index.html");

app.Run();
