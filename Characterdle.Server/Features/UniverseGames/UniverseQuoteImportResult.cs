namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseQuoteImportResult(
    string QuotesFilePath,
    int QuoteCount,
    int GameCount,
    int LinkedGameCount,
    int SpeakerCount);
