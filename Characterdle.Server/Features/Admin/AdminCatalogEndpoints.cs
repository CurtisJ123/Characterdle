using Npgsql;

namespace Characterdle.Server.Features.Admin;

public static partial class AdminCatalogEndpoints
{
    // This group must be mapped inside the existing verified-admin route group.
    public static void MapAdminCatalogEndpoints(this RouteGroupBuilder admin)
    {
        var catalog = admin.MapGroup("/got").AddEndpointFilter(async (context, next) =>
        {
            try { return await next(context); }
            catch (AdminCatalogValidationException ex) { return Invalid(ex.Message); }
            catch (AdminCatalogConflictException ex) { return Results.Problem(ex.Message, statusCode: 409); }
            catch (BadHttpRequestException ex) { return Results.Problem(ex.StatusCode == 413 ? "Creation request is too large." : "Invalid request.", statusCode: ex.StatusCode); }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            { return Results.Problem("That character/quote combination already exists. Review your changes.", statusCode: 409); }
            catch (PostgresException ex) when (ex.SqlState is PostgresErrorCodes.ForeignKeyViolation or PostgresErrorCodes.CheckViolation)
            { return Invalid("The row references invalid data. Refresh and check your changes."); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("AdminCatalog")
                    .LogError(ex, "Admin catalog request failed.");
                return Results.Problem("Game content is temporarily unavailable. Please try again.", statusCode: 503);
            }
        });
        catalog.MapGet("/characters", async (IAdminCatalogRepository repo, CancellationToken ct) => Results.Ok(await repo.CharactersAsync(ct)));
        catalog.MapGet("/quotes", async (IAdminCatalogRepository repo, CancellationToken ct) => Results.Ok(await repo.QuotesAsync(ct)));
        catalog.MapGet("/options", async (IAdminCatalogRepository repo, CancellationToken ct) => Results.Ok(await repo.OptionsAsync(ct)));
        catalog.MapPost("/characters", CreateCharacterAsync);
        catalog.MapPost("/quotes", CreateQuoteAsync);
        catalog.MapPut("/characters/{id:long}", async (long id, SaveAdminCharacter request, IAdminCatalogRepository repo, CancellationToken ct) =>
        {
            if (!AdminCatalogValidation.ValidId(id)) return Invalid("Invalid character ID.");
            if (AdminCatalogValidation.Validate(request) is { } error) return Invalid(error);
            return await repo.UpdateCharacterAsync(id, request, ct) is { } row ? Results.Ok(row) : Conflict();
        });
        catalog.MapPut("/quotes/{id:long}", async (long id, SaveAdminQuote request, IAdminCatalogRepository repo, CancellationToken ct) =>
        {
            if (!AdminCatalogValidation.ValidId(id)) return Invalid("Invalid quote ID.");
            if (AdminCatalogValidation.Validate(request) is { } error) return Invalid(error);
            return await repo.UpdateQuoteAsync(id, request, ct) is { } row ? Results.Ok(row) : Conflict();
        });
    }

    private static IResult Invalid(string message) => Results.ValidationProblem(new Dictionary<string, string[]> { ["row"] = [message] });
    private static IResult Conflict() => Results.Problem("This row changed or was removed. Discard your edit and refresh before trying again.", statusCode: 409);
}
