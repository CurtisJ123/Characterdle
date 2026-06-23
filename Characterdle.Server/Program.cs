using System.Net.Http.Headers;
using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Profile;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var renderPort = Environment.GetEnvironmentVariable("PORT");

if (int.TryParse(renderPort, out var parsedRenderPort)
    && parsedRenderPort > 0
    && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{parsedRenderPort}");
}

// Add services to the container.

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.Configure<ClientAppOptions>(builder.Configuration.GetSection(ClientAppOptions.SectionName));
builder.Services.Configure<SchedulingOptions>(builder.Configuration.GetSection(SchedulingOptions.SectionName));
builder.Services.Configure<SupabaseOptions>(builder.Configuration.GetSection(SupabaseOptions.SectionName));

var clientAppOptions = builder.Configuration.GetSection(ClientAppOptions.SectionName).Get<ClientAppOptions>() ?? new();
var allowedOrigins = clientAppOptions.AllowedOrigins
    .Where(static origin => !string.IsNullOrWhiteSpace(origin))
    .Select(static origin => origin.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ClientApp", policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            return;
        }

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var supabaseConnectionString = builder.Configuration.GetConnectionString("Supabase");
var supabaseOptions = builder.Configuration.GetSection(SupabaseOptions.SectionName).Get<SupabaseOptions>() ?? new();

if (string.IsNullOrWhiteSpace(supabaseConnectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Supabase' is not configured. Set it with dotnet user-secrets for local development.");
}

if (string.IsNullOrWhiteSpace(supabaseOptions.Url) || string.IsNullOrWhiteSpace(supabaseOptions.PublishableKey))
{
    throw new InvalidOperationException(
        "Supabase URL and publishable key must be configured in appsettings.");
}

builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(supabaseConnectionString));
builder.Services.AddSingleton(UniverseCatalog.CreateDefault());
builder.Services.AddScoped<IUniverseGameRepository, SupabaseUniverseGameRepository>();
builder.Services.AddScoped<ILeaderboardRepository, LeaderboardRepository>();
builder.Services.AddScoped<IProfileRepository, ProfileRepository>();
builder.Services.AddSingleton<UniverseGameScheduler>();
builder.Services.AddHttpClient<SupabaseAuthClient>(client =>
{
    client.BaseAddress = new Uri(supabaseOptions.Url);
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    client.DefaultRequestHeaders.Add("apikey", supabaseOptions.PublishableKey);
});
builder.Services.AddHostedService<UniverseGameScheduleService>();

var app = builder.Build();

if (args.Length > 0 && string.Equals(args[0], "run-scheduled-games", StringComparison.OrdinalIgnoreCase))
{
    var scheduler = app.Services.GetRequiredService<UniverseGameScheduler>();
    await scheduler.RunOnceAsync(CancellationToken.None);
    Console.WriteLine("Scheduled universe game generation completed.");
    return;
}

app.UseDefaultFiles();
app.MapStaticAssets();
app.UseExceptionHandler();
app.UseMiddleware<ApiRequestLoggingMiddleware>();
app.UseCors("ClientApp");

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
app.MapGet("/api/client-config", (HttpContext httpContext, IOptions<SupabaseOptions> options) =>
{
    httpContext.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";

    return Results.Json(new
    {
        apiBaseUrl = clientAppOptions.ApiBaseUrl,
        supabasePublishableKey = options.Value.PublishableKey,
        supabaseUrl = options.Value.Url,
    });
})
    .ExcludeFromDescription();
app.MapUniverseGameEndpoints();
app.MapLeaderboardEndpoints();
app.MapProfileEndpoints();

app.MapFallbackToFile("/index.html");

app.Run();
