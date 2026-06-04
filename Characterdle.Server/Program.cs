using System.Net.Http.Headers;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Profile;
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
var supabaseUrl = builder.Configuration["Supabase:Url"];
var supabasePublishableKey = builder.Configuration["Supabase:PublishableKey"];

if (string.IsNullOrWhiteSpace(supabaseConnectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Supabase' is not configured. Set it with dotnet user-secrets for local development.");
}

if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(supabasePublishableKey))
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
builder.Services.AddSingleton<UniverseGameSchemaInitializer>();
builder.Services.AddSingleton<UniverseQuoteImportService>();
builder.Services.AddSingleton<LeaderboardSchemaInitializer>();
builder.Services.AddHttpClient<SupabaseAuthClient>(client =>
{
    client.BaseAddress = new Uri(supabaseUrl);
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    client.DefaultRequestHeaders.Add("apikey", supabasePublishableKey);
});
builder.Services.AddHostedService<UniverseGameScheduleService>();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var universeGameSchemaInitializer = scope.ServiceProvider.GetRequiredService<UniverseGameSchemaInitializer>();
    await universeGameSchemaInitializer.EnsureInitializedAsync();

    var leaderboardSchemaInitializer = scope.ServiceProvider.GetRequiredService<LeaderboardSchemaInitializer>();
    await leaderboardSchemaInitializer.EnsureInitializedAsync();
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
app.MapLeaderboardEndpoints();
app.MapProfileEndpoints();

app.MapFallbackToFile("/index.html");

app.Run();
