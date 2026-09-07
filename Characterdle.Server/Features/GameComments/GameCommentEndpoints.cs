using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Auth;

namespace Characterdle.Server.Features.GameComments;

public static class GameCommentEndpoints
{
    public static IEndpointRouteBuilder MapGameCommentEndpoints(this IEndpointRouteBuilder app)
    {
        var comments = app.MapGroup("/api/universes/{universeId}/games/{gameId:long}/{mode}/comments")
            .WithTags("Game Comments")
            .AddEndpointFilter(async (context, next) =>
            {
                context.HttpContext.Response.Headers.CacheControl = "private, no-store";
                context.HttpContext.Response.Headers.Vary = "Authorization";
                return await next(context);
            });

        comments.MapGet("/", GetPageAsync)
            .Produces<GameCommentsPageResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .ProducesValidationProblem();
        comments.MapPost("/", CreateAsync)
            .Produces<GameCommentResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .ProducesValidationProblem();
        return app;
    }

    private static async Task<IResult> GetPageAsync(
        string universeId, long gameId, string mode, int? page,
        UniverseCatalog catalog, ICurrentSupabaseUserAccessor currentUserAccessor,
        IGameCommentRepository repository, ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        try
        {
            var user = await currentUserAccessor.GetCurrentUserAsync(cancellationToken);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            if (!TryResolveGame(catalog, universeId, gameId, mode, out var universe))
            {
                return Results.NotFound();
            }

            var requestedPage = page ?? 1;
            if (requestedPage < 1)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["page"] = ["Page must be positive."] });
            }

            var result = await repository.GetPageAsync(user.UserId, universe, gameId, mode, requestedPage, cancellationToken);
            return result is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(result);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return Unavailable(exception, loggerFactory);
        }
    }

    private static async Task<IResult> CreateAsync(
        string universeId, long gameId, string mode, CreateGameCommentRequest request,
        UniverseCatalog catalog, ICurrentSupabaseUserAccessor currentUserAccessor,
        IGameCommentRepository repository, ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        try
        {
            var user = await currentUserAccessor.GetCurrentUserAsync(cancellationToken);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            if (!TryResolveGame(catalog, universeId, gameId, mode, out var universe))
            {
                return Results.NotFound();
            }

            var body = request.Body?.Replace("\r\n", "\n").Replace('\r', '\n').Trim();
            if (string.IsNullOrWhiteSpace(body) || request.Body!.Length > 300
                || body.Any(character => char.IsControl(character) && character is not '\n' and not '\t'))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["body"] = ["Enter a comment between 1 and 300 characters without control characters."],
                });
            }

            // Store plain text. Clients must render it as text, never as HTML or Markdown.
            var result = await repository.CreateAsync(user.UserId, universe, gameId, mode, body, cancellationToken);
            return result is null
                ? Results.StatusCode(StatusCodes.Status403Forbidden)
                : Results.Json(result, statusCode: StatusCodes.Status201Created);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return Unavailable(exception, loggerFactory);
        }
    }

    private static bool TryResolveGame(UniverseCatalog catalog, string universeId, long gameId, string mode,
        out UniverseDefinition universe)
    {
        universe = null!;
        return gameId > 0 && mode is "character" or "quote" && catalog.TryGet(universeId, out universe)
            && (mode != "quote" || !string.IsNullOrWhiteSpace(universe.QuoteTableName));
    }

    private static IResult Unavailable(Exception exception, ILoggerFactory loggerFactory)
    {
        loggerFactory.CreateLogger(typeof(GameCommentEndpoints).FullName!).LogError(exception, "Game comments request failed.");
        return Results.Problem(title: "Comments are temporarily unavailable.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}
