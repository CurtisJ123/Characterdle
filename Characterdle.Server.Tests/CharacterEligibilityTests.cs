using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.UniverseGames;
using Npgsql;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class CharacterEligibilityTests
{
    [Theory]
    [InlineData(true, null, null, true)]
    [InlineData(true, null, 200L, true)]
    [InlineData(false, 104L, null, false)]
    [InlineData(false, 104L, 0L, false)]
    [InlineData(false, 104L, 103L, true)]
    [InlineData(false, 104L, 104L, true)]
    [InlineData(false, 104L, 105L, false)]
    [InlineData(false, 0L, 1L, false)]
    [InlineData(false, null, 1L, false)]
    public void HistoricalPoolDoesNotDependOnWhetherTheCharacterIsTheAnswer(
        bool active, long? cutoff, long? gameId, bool expected) =>
        Assert.Equal(expected, UniverseCharacterEligibility.CanGuess(active, cutoff, gameId));

    [Fact]
    public void ScheduledCharacterAndQuoteSelectionRequireActiveCharacters()
    {
        var sql = SupabaseUniverseGameRepository.BuildScheduledGameQuery(UniverseCatalog.CreateDefault().Universes[0]);
        Assert.Contains("where characters.is_active", sql);
        Assert.Contains("speakers.id = quotes.character_id and speakers.is_active", sql);
        Assert.Contains("left join chosen_quote on true", sql); // No eligible quotes must not block character games.
        Assert.Contains("count(games.id)", sql);
        Assert.Contains("@selectionSeed", sql);
    }

    [Fact]
    public void CharacterOnlyUniverseStillHasValidEmptyQuoteSelection()
    {
        var universe = UniverseCatalog.CreateDefault().Universes[0] with { QuoteTableName = null };
        var sql = SupabaseUniverseGameRepository.BuildScheduledGameQuery(universe);
        Assert.Contains("select null::bigint as id where false", sql);
        Assert.DoesNotContain("join chosen_quote", sql);
    }

    [Fact]
    public void ServerChecksHistoricalEligibilityAndUnknownIdsWithBoundParameters()
    {
        using var cmd = UniverseCharacterEligibility.ValidateGuesses(UniverseCatalog.CreateDefault().Universes[0], 12345, [345, 13]);
        Assert.Contains("characters.id is null", cmd.CommandText);
        Assert.Contains("characters.is_active or coalesce(@gameId <= characters.inactive_after_game_id, false)", cmd.CommandText);
        Assert.DoesNotContain("12345", cmd.CommandText);
        Assert.Equal(12345L, cmd.Parameters["gameId"].Value);
        Assert.Equal(new long[] { 345, 13 }, Assert.IsType<long[]>(cmd.Parameters["guesses"].Value));
    }

    [Fact]
    public void RandomGamesExcludeInactiveAnswersButPortraitsKeepThem()
    {
        var universe = UniverseCatalog.CreateDefault().Universes[0];
        Assert.Contains("where characters.is_active", SupabaseUniverseGameRepository.BuildRandomCharacterQuery(universe));
        Assert.Contains("speakers.id = quotes.character_id and speakers.is_active", SupabaseUniverseGameRepository.BuildRandomQuoteQuery(universe));
        Assert.DoesNotContain("is_active", SupabaseUniverseGameRepository.BuildAvatarOptionsQuery(universe));
    }

    [Fact]
    public void CharacterCreationDefaultsToActiveButSupportsInactiveDrafts()
    {
        var request = new NewAdminCharacter("Little Sam", [], "Male", "Human", ["Lowborn"], ["Child"], 3, 8, true, null);
        Assert.True(request.AsEdit().IsActive);
        Assert.False((request with { IsActive = false }).AsEdit().IsActive);
    }

    [Fact]
    public void OlderAdminClientsDoNotImplicitlyReactivateCharacters()
    {
        var request = new SaveAdminCharacter("1", "Little Sam", [], "Male", "Human", ["Lowborn"], ["Child"], 3, 8, true, null);
        using var cmd = new NpgsqlCommand();
        AdminCatalogRepository.CharacterParameters(cmd, request);
        Assert.Equal(DBNull.Value, cmd.Parameters["isActive"].Value);
        using var disabled = new NpgsqlCommand();
        AdminCatalogRepository.CharacterParameters(disabled, request with { IsActive = false });
        Assert.Equal(false, disabled.Parameters["isActive"].Value);
    }
}
