using System.Text.Json.Serialization;

namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseAttributeDefinition(
    string Key,
    string Label,
    [property: JsonIgnore]
    string ColumnName,
    string Kind,
    string? EmptyLabel = null,
    string? TrueLabel = null,
    string? FalseLabel = null);
