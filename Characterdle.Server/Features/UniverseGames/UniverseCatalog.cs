namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseCatalog
{
    private readonly IReadOnlyDictionary<string, UniverseDefinition> _universes;

    public UniverseCatalog(IReadOnlyList<UniverseDefinition> universes)
    {
        _universes = universes.ToDictionary(universe => universe.Id, StringComparer.OrdinalIgnoreCase);
        Universes = universes;
    }

    public IReadOnlyList<UniverseDefinition> Universes { get; }

    public bool TryGet(string universeId, out UniverseDefinition universe)
    {
        return _universes.TryGetValue(universeId, out universe!);
    }

    public static UniverseCatalog CreateDefault()
    {
        return new UniverseCatalog([
            new UniverseDefinition(
                Id: "got",
                DisplayName: "Game of Thrones",
                ScheduleTimeZoneId: "America/New_York",
                CharacterTableName: "public.\"GOTCharacters\"",
                GameTableName: "public.\"GOTGames\"",
                QuoteTableName: "public.\"GOTQuotes\"",
                AttributeDefinitions:
                [
                    new UniverseAttributeDefinition("gender", "Gender", "gender", "string", "ERROR"),
                    new UniverseAttributeDefinition("species", "Species", "species", "string", "ERROR"),
                    new UniverseAttributeDefinition("house", "Houses", "house", "list", "Lowborn"),
                    new UniverseAttributeDefinition("occupation", "Roles", "occupation", "list", "ERROR"),
                    new UniverseAttributeDefinition("debutSeason", "Debut Season", "debut_season", "number", "ERROR"),
                    new UniverseAttributeDefinition("lastSeason", "Last Season", "last_season", "number", "ERROR"),
                    new UniverseAttributeDefinition("alive", "Status", "alive", "boolean", "ERROR", "Alive", "Dead", "Last known status of the character."),
                ])
        ]);
    }
}
