using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Characterdle.Server.Features.Admin;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests
{
    private static CreateAdminCharacter NewCharacter() => new(Guid.NewGuid(),
        new("New character", [], "Female", "Human", ["House Stark"], [], 1, 8, true, null), null);
    private static CreateAdminQuote NewQuote() => new(Guid.NewGuid(), new(1, "Not today.", 1, 2, 2));

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("invalid", HttpStatusCode.Unauthorized)]
    [InlineData("player", HttpStatusCode.Forbidden)]
    public async Task CatalogCreationRequiresVerifiedAdmin(string? token, HttpStatusCode status)
    {
        SignIn(token);
        Assert.Equal(status, (await client.PostAsJsonAsync($"/api/admin/got/characters?isAdmin=true&userId={AdminId}", NewCharacter())).StatusCode);
        Assert.Equal(status, (await client.PostAsJsonAsync("/api/admin/got/quotes", NewQuote())).StatusCode);
        Assert.Equal(0, creator.Writes);
    }

    [Fact]
    public async Task CatalogCreationReturnsRowsAndUsesNoStoreHeaders()
    {
        SignIn("admin");
        var request = NewCharacter();
        var response = await client.PostAsJsonAsync("/api/admin/got/characters", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/admin/got/characters/101", response.Headers.Location!.ToString());
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.Contains("Authorization", response.Headers.Vary);
        Assert.Null(creator.Portrait);
        Assert.Equal(request.RequestId, creator.CharacterRequest!.RequestId);
        Assert.Equal(request.Character.DisplayName, creator.CharacterRequest.Character.DisplayName);
        Assert.Equal(request.Character.House, creator.CharacterRequest.Character.House);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/got/quotes", NewQuote())).StatusCode);
        Assert.Equal(2, creator.Writes);
    }

    [Fact]
    public async Task CatalogCreationValidatesPortraitBeforeCallingPersistence()
    {
        SignIn("admin");
        var png = Convert.ToBase64String(AnnouncementImageTests.Png);
        var request = NewCharacter() with { Portrait = new("image/png", png) };
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/got/characters", request)).StatusCode);
        Assert.Equal(AnnouncementImageTests.Png, creator.Portrait!.Data);
        foreach (var bad in new[] { request with { Portrait = new("image/svg+xml", png) },
            request with { Portrait = new("image/jpeg", png) }, request with { Portrait = new("image/png", "not base64") },
            request with { Portrait = new("image/png", Convert.ToBase64String(Encoding.UTF8.GetBytes("<script>alert(1)</script>"))) },
            request with { Character = request.Character with { PortraitUrl = "/images/existing.png" } } })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/got/characters", bad)).StatusCode);
        Assert.Equal(1, creator.Writes);
    }

    [Fact]
    public async Task CatalogCreationRejectsInvalidRequiredFields()
    {
        SignIn("admin");
        var character = NewCharacter();
        foreach (var bad in new[] { character with { RequestId = Guid.Empty }, character with { Character = null! },
            character with { Character = character.Character with { DisplayName = " " } },
            character with { Character = character.Character with { Aliases = null! } },
            character with { Character = character.Character with { LastSeason = 0 } },
            character with { Character = character.Character with { PortraitUrl = "javascript:alert(1)" } } })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/got/characters", bad)).StatusCode);
        var quote = NewQuote();
        foreach (var bad in new[] { quote with { RequestId = Guid.Empty }, quote with { Quote = null! },
            quote with { Quote = quote.Quote with { CharacterId = -1 } }, quote with { Quote = quote.Quote with { EpisodeTitleId = 0 } },
            quote with { Quote = quote.Quote with { SeasonNumber = 8, EpisodeNumber = 7 } }, quote with { Quote = quote.Quote with { QuoteText = "\0" } } })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/got/quotes", bad)).StatusCode);
        foreach (var json in new[] { "null", "{}", "{", "{\"requestId\":\"invalid\"}",
            $"{{\"requestId\":\"{Guid.NewGuid()}\",\"character\":{{\"displayName\":\"Arya\"}}}}" })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/got/characters", new StringContent(json, Encoding.UTF8, "application/json"))).StatusCode);
        Assert.Equal(0, creator.Writes);
    }

    [Fact]
    public async Task CatalogCreationBoundsUnknownLengthBodies()
    {
        SignIn("admin");
        using var body = new UnknownLengthContent(new byte[7 * 1024 * 1024 + 1]);
        body.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await client.PostAsync("/api/admin/got/characters", body)).StatusCode);
        Assert.Equal(0, creator.Writes);
    }

    [Fact]
    public async Task CatalogCreationPreservesLiteralTextAndReportsConflictsSafely()
    {
        SignIn("admin");
        const string literal = "O'Brien <script>alert(1)</script>; DROP TABLE users; --";
        var request = NewQuote();
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/got/quotes", request with { Quote = request.Quote with { QuoteText = literal } })).StatusCode);
        Assert.Equal(literal, creator.QuoteRequest!.Quote.QuoteText);
        creator.Failure = new AdminCatalogConflictException("A character with this name already exists.");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/admin/got/characters", NewCharacter())).StatusCode);
        creator.Failure = new AdminCatalogValidationException("Episode title must match the selected season and episode.");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/got/quotes", request)).StatusCode);
        creator.Failure = new InvalidOperationException("private-storage-key");
        var response = await client.PostAsJsonAsync("/api/admin/got/characters", NewCharacter());
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("private-storage-key", await response.Content.ReadAsStringAsync());
    }

    private sealed class CatalogCreator : IAdminCatalogCreator
    {
        public int Writes;
        public Exception? Failure;
        public CreateAdminCharacter? CharacterRequest;
        public CreateAdminQuote? QuoteRequest;
        public ValidatedAdminPortrait? Portrait;
        public Task<AdminCharacter> CreateCharacterAsync(CreateAdminCharacter r, ValidatedAdminPortrait? portrait, CancellationToken ct)
        {
            if (Failure is not null) throw Failure;
            Writes++; CharacterRequest = r; Portrait = portrait;
            var c = r.Character;
            return Task.FromResult(new AdminCharacter(101, "124", c.DisplayName, c.Aliases, c.Gender, c.Species,
                c.House, c.Occupation, c.DebutSeason, c.LastSeason, c.Alive, portrait is null ? c.PortraitUrl : "https://storage.example/portrait.png"));
        }
        public Task<AdminQuote> CreateQuoteAsync(CreateAdminQuote r, CancellationToken ct)
        {
            if (Failure is not null) throw Failure;
            Writes++; QuoteRequest = r;
            var q = r.Quote;
            return Task.FromResult(new AdminQuote(102, "124", q.CharacterId, q.QuoteText, q.SeasonNumber, q.EpisodeNumber, q.EpisodeTitleId));
        }
    }
}
