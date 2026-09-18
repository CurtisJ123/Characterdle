using System.Net;
using System.Net.Http.Json;
using Characterdle.Server.Features.Admin;
using Npgsql;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests
{
    private static SaveAdminCharacter CharacterEdit() => new("123", "Arya Stark", ["No One"], "Female", "Human", ["House Stark"], ["Assassin"], 1, 8, true, null);
    private static SaveAdminQuote QuoteEdit() => new("123", 1, "Not today.", 1, 2, 2);

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("invalid", HttpStatusCode.Unauthorized)]
    [InlineData("player", HttpStatusCode.Forbidden)]
    public async Task CatalogReadsAndWritesRequireVerifiedAdmin(string? token, HttpStatusCode expected)
    {
        SignIn(token);
        foreach (var path in new[] { "characters", "quotes", "options" })
            Assert.Equal(expected, (await client.GetAsync($"/api/admin/got/{path}?isAdmin=true&userId={AdminId}")).StatusCode);
        Assert.Equal(expected, (await client.PutAsJsonAsync("/api/admin/got/characters/1", CharacterEdit())).StatusCode);
        Assert.Equal(expected, (await client.PutAsJsonAsync("/api/admin/got/quotes/1", QuoteEdit())).StatusCode);
        Assert.Equal(0, catalog.Reads); Assert.Equal(0, catalog.Writes);
    }

    [Fact]
    public async Task CatalogAdminCanReadAndUpdateExistingRowsWithoutCaching()
    {
        SignIn("admin");
        foreach (var path in new[] { "characters", "quotes", "options" })
        {
            var response = await client.GetAsync($"/api/admin/got/{path}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
            Assert.Contains("Authorization", response.Headers.Vary);
            Assert.Contains("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        }
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/admin/got/characters/7", CharacterEdit())).StatusCode);
        Assert.Equal(7, catalog.LastId); Assert.Equal("123", catalog.CharacterRequest!.ExpectedVersion);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/admin/got/quotes/8", QuoteEdit())).StatusCode);
        Assert.Equal(8, catalog.LastId); Assert.Equal(2, catalog.Writes);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/got/characters", CharacterEdit())).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync("/api/admin/got/quotes/8")).StatusCode);
        Assert.Equal(2, catalog.Writes);
    }

    [Fact]
    public async Task CatalogRejectsInvalidAndIncompleteCharacterUpdates()
    {
        SignIn("admin");
        foreach (var request in new[] {
            CharacterEdit() with { DisplayName = " " }, CharacterEdit() with { DisplayName = "Bad\0name" },
            CharacterEdit() with { Aliases = null! }, CharacterEdit() with { House = [""] },
            CharacterEdit() with { Occupation = [new string('x', 201)] }, CharacterEdit() with { Gender = null! },
            CharacterEdit() with { ExpectedVersion = "123; DROP TABLE" }, CharacterEdit() with { ExpectedVersion = "" },
            CharacterEdit() with { DebutSeason = 9 }, CharacterEdit() with { LastSeason = 0 },
            CharacterEdit() with { PortraitUrl = "javascript:alert(1)" }, CharacterEdit() with { PortraitUrl = "//evil.test/a" },
            CharacterEdit() with { PortraitUrl = "https://user:password@example.test/a" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/got/characters/1", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/got/characters/1", new { expectedVersion = "123", displayName = "Arya" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/got/characters/0", CharacterEdit())).StatusCode);
        Assert.Equal(0, catalog.Writes);
    }

    [Fact]
    public async Task CatalogRejectsInvalidQuotesAndAllowsLiteralTextWithoutInterpretingIt()
    {
        SignIn("admin");
        foreach (var request in new[] { QuoteEdit() with { QuoteText = " " }, QuoteEdit() with { QuoteText = new string('x', 10001) },
            QuoteEdit() with { CharacterId = 0 }, QuoteEdit() with { EpisodeTitleId = -1 },
            QuoteEdit() with { SeasonNumber = 9 }, QuoteEdit() with { EpisodeNumber = 11 },
            QuoteEdit() with { SeasonNumber = 7, EpisodeNumber = 8 }, QuoteEdit() with { SeasonNumber = 8, EpisodeNumber = 7 } })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/got/quotes/1", request)).StatusCode);
        Assert.Equal(0, catalog.Writes);
        const string literal = "O'Brien says <script>alert(1)</script>; DROP TABLE users; --";
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/admin/got/quotes/1", QuoteEdit() with { QuoteText = literal, EpisodeTitleId = null })).StatusCode);
        Assert.Equal(literal, catalog.QuoteRequest!.QuoteText);
    }

    [Fact]
    public async Task CatalogConflictsAndReferenceFailuresAreReportedSafely()
    {
        SignIn("admin"); catalog.Conflict = true;
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/admin/got/characters/1", CharacterEdit())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/admin/got/quotes/1", QuoteEdit())).StatusCode);
        catalog.Conflict = false;
        catalog.Failure = new AdminCatalogValidationException("Episode title must match the selected season and episode.");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/got/quotes/1", QuoteEdit())).StatusCode);
        catalog.Failure = new PostgresException("private-db-details", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation);
        var duplicate = await client.PutAsJsonAsync("/api/admin/got/quotes/1", QuoteEdit());
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.DoesNotContain("private-db-details", await duplicate.Content.ReadAsStringAsync());
        catalog.Failure = new InvalidOperationException("private-db-details");
        var failure = await client.GetAsync("/api/admin/got/characters");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failure.StatusCode);
        Assert.DoesNotContain("private-db-details", await failure.Content.ReadAsStringAsync());
    }

    private sealed class CatalogStore : IAdminCatalogRepository
    {
        public int Reads, Writes;
        public long LastId;
        public bool Conflict;
        public Exception? Failure;
        public SaveAdminCharacter? CharacterRequest;
        public SaveAdminQuote? QuoteRequest;
        private static readonly AdminCharacter Character = new(1, "123", "Arya Stark", [], "Female", "Human", ["House Stark"], [], 1, 8, true, null);
        private static readonly AdminQuote Quote = new(1, "123", 1, "Not today.", 1, 2, 2);
        public Task<IReadOnlyList<AdminCharacter>> CharactersAsync(CancellationToken ct)
        { if (Failure is not null) throw Failure; Reads++; return Task.FromResult<IReadOnlyList<AdminCharacter>>([Character]); }
        public Task<IReadOnlyList<AdminQuote>> QuotesAsync(CancellationToken ct)
        { Reads++; return Task.FromResult<IReadOnlyList<AdminQuote>>([Quote]); }
        public Task<AdminCatalogOptions> OptionsAsync(CancellationToken ct)
        { Reads++; return Task.FromResult(new AdminCatalogOptions([new(1, "Arya Stark")], [new(2, 1, 2, "The Kingsroad")])); }
        public Task<AdminCharacter?> UpdateCharacterAsync(long id, SaveAdminCharacter request, CancellationToken ct)
        {
            if (Failure is not null) throw Failure;
            Writes++; LastId = id; CharacterRequest = request;
            return Task.FromResult<AdminCharacter?>(Conflict ? null : Character with { Id = id, Version = "124" });
        }
        public Task<AdminQuote?> UpdateQuoteAsync(long id, SaveAdminQuote request, CancellationToken ct)
        {
            if (Failure is not null) throw Failure;
            Writes++; LastId = id; QuoteRequest = request;
            return Task.FromResult<AdminQuote?>(Conflict ? null : Quote with { Id = id, Version = "124" });
        }
    }
}
