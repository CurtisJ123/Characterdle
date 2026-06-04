using System.Net.Http.Headers;
using System.Text.Json;
using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Profile;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Database;
using Characterdle.Server.Infrastructure.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Add services to the container.

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.Configure<DatabaseOptions>(builder.Configuration.GetSection(DatabaseOptions.SectionName));
builder.Services.Configure<SchedulingOptions>(builder.Configuration.GetSection(SchedulingOptions.SectionName));
builder.Services.Configure<SupabaseOptions>(builder.Configuration.GetSection(SupabaseOptions.SectionName));

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
builder.Services.AddSingleton<UniverseCharacterCleanupService>();
builder.Services.AddSingleton<UniverseQuoteImportService>();
builder.Services.AddSingleton<UniverseGameScheduler>();
builder.Services.AddSingleton<DatabaseMigrator>();
builder.Services.AddSingleton<IDatabaseMigration, Migration001CreateGotCoreSchema>();
builder.Services.AddSingleton<IDatabaseMigration, Migration002CreateGotQuotesSchema>();
builder.Services.AddSingleton<IDatabaseMigration, Migration003CreateLeaderboardSchema>();
builder.Services.AddSingleton<IDatabaseMigration, Migration004ApplyRowLevelSecurityPolicies>();
builder.Services.AddHttpClient<SupabaseAuthClient>(client =>
{
    client.BaseAddress = new Uri(supabaseOptions.Url);
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    client.DefaultRequestHeaders.Add("apikey", supabaseOptions.PublishableKey);
});
builder.Services.AddHostedService<UniverseGameScheduleService>();

var app = builder.Build();
var databaseOptions = app.Services.GetRequiredService<IOptions<DatabaseOptions>>().Value;

if (databaseOptions.RunMigrationsOnStartup || args.Any(static arg => string.Equals(arg, "migrate", StringComparison.OrdinalIgnoreCase)))
{
    var migrator = app.Services.GetRequiredService<DatabaseMigrator>();
    await migrator.ApplyPendingMigrationsAsync();
}

if (args.Length > 0 && string.Equals(args[0], "migrate", StringComparison.OrdinalIgnoreCase))
{
    Console.WriteLine("Database migrations completed.");
    return;
}

if (args.Length > 0 && string.Equals(args[0], "import-quotes", StringComparison.OrdinalIgnoreCase))
{
    var quotesFilePath = args.Length > 1
        ? Path.GetFullPath(args[1])
        : Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "Quotes.txt"));
    var quoteImportService = app.Services.GetRequiredService<UniverseQuoteImportService>();
    var importResult = await quoteImportService.ImportAsync(quotesFilePath);

    Console.WriteLine(
        $"Quote import complete. Quotes={importResult.QuoteCount}, Speakers={importResult.SpeakerCount}, LinkedGames={importResult.LinkedGameCount}/{importResult.GameCount}, File={importResult.QuotesFilePath}");
    return;
}

if (args.Length > 0 && string.Equals(args[0], "cleanup-characters", StringComparison.OrdinalIgnoreCase))
{
    var parsedCharacterIds = args
        .Skip(1)
        .SelectMany(value => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        .Select(value => long.TryParse(value, out var parsedValue)
            ? parsedValue
            : throw new InvalidOperationException($"'{value}' is not a valid character id."))
        .ToArray();

    var cleanupService = app.Services.GetRequiredService<UniverseCharacterCleanupService>();
    var cleanupResult = await cleanupService.CleanupAsync(parsedCharacterIds);

    Console.WriteLine(
        $"Character cleanup complete. Deleted={cleanupResult.DeletedCharacters.Count}, QuotesRemoved={cleanupResult.DeletedQuoteCount}, GamesReassigned={cleanupResult.ReassignedGameCount}.");

    foreach (var deletedCharacter in cleanupResult.DeletedCharacters)
    {
        Console.WriteLine(
            $"{deletedCharacter.Id}|{deletedCharacter.DisplayName}|{deletedCharacter.PortraitUrl ?? string.Empty}");
    }

    return;
}

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
