using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Profile;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/profile/{universeId}", GetProfileAsync)
            .WithTags("Profile")
            .WithName("GetUniverseProfile")
            .Produces<UserUniverseProfileResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        app.MapGet("/api/profile/{universeId}/results", GetGameResultsAsync)
            .WithTags("Profile")
            .WithName("GetUniverseGameResults")
            .Produces<IReadOnlyList<UniverseGameResultResponse>>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        app.MapPatch("/api/profile", UpdateProfileAsync)
            .WithTags("Profile")
            .WithName("UpdateProfile")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        app.MapGet("/api/profile/account-deletion", GetAccountDeletionStatusAsync)
            .WithTags("Profile")
            .WithName("GetAccountDeletionStatus")
            .Produces<AccountDeletionStatusResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        app.MapDelete("/api/profile", DeleteAccountAsync)
            .WithTags("Profile")
            .WithName("DeleteAccount")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<AccountDeletionStatusResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    private static async Task<IResult> GetProfileAsync(
        string universeId,
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        SupabaseAuthClient authClient,
        ILeaderboardRepository leaderboardRepository,
        IProfileRepository profileRepository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var accessToken = ReadBearerToken(httpRequest);

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return Results.Unauthorized();
            }

            var user = await authClient.GetUserAsync(accessToken, cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            await leaderboardRepository.EnsurePlayerProfileAsync(user, cancellationToken);

            var profile = await profileRepository.GetProfileAsync(universe, user.UserId, cancellationToken);

            if (profile is null)
            {
                return Results.NotFound(new { message = "Profile not found." });
            }

            return Results.Ok(profile);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(ProfileEndpoints).FullName!);
            logger.LogError(exception, "Unable to load profile data for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading profile data.";

            return Results.Problem(
                title: "Unable to load profile data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> UpdateProfileAsync(
        UpdateProfileRequest request,
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        SupabaseAuthClient authClient,
        IProfileRepository profileRepository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var validationErrors = ValidateUpdate(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!universeCatalog.TryGet("got", out var avatarUniverse))
            {
                return Results.Problem(
                    title: "Unable to update profile data.",
                    detail: "The avatar character universe is not configured.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var accessToken = ReadBearerToken(httpRequest);

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return Results.Unauthorized();
            }

            var user = await authClient.GetUserAsync(accessToken, cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            var normalizedAvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl)
                ? null
                : request.AvatarUrl.Trim();

            if (normalizedAvatarUrl is not null)
            {
                var isAvailable = await profileRepository.IsAvatarUrlAvailableAsync(
                    avatarUniverse,
                    normalizedAvatarUrl,
                    cancellationToken);

                if (!isAvailable)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["avatarUrl"] = ["Select one of the available Game of Thrones character portraits."],
                    });
                }
            }

            await profileRepository.UpdateProfileAsync(
                user.UserId,
                user.Email,
                request.DisplayName.Trim(),
                normalizedAvatarUrl,
                cancellationToken);

            return Results.NoContent();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(ProfileEndpoints).FullName!);
            logger.LogError(exception, "Unable to update profile data.");

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while updating profile data.";

            return Results.Problem(
                title: "Unable to update profile data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetAccountDeletionStatusAsync(
        HttpRequest httpRequest,
        SupabaseAuthClient authClient,
        SupabaseAdminAuthClient adminAuthClient,
        IAccountDeletionGuard accountDeletionGuard,
        CancellationToken cancellationToken)
    {
        var accessToken = ReadBearerToken(httpRequest);

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Results.Unauthorized();
        }

        var user = await authClient.GetUserAsync(accessToken, cancellationToken);

        if (user is null)
        {
            return Results.Unauthorized();
        }

        var status = await BuildAccountDeletionStatusAsync(
            user.UserId,
            adminAuthClient,
            accountDeletionGuard,
            cancellationToken);

        return Results.Ok(status);
    }

    private static async Task<IResult> DeleteAccountAsync(
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        SupabaseAuthClient authClient,
        SupabaseAdminAuthClient adminAuthClient,
        IAccountDeletionGuard accountDeletionGuard,
        IProfileRepository profileRepository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var accessToken = ReadBearerToken(httpRequest);

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return Results.Unauthorized();
            }

            var user = await authClient.GetUserAsync(accessToken, cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            var status = await BuildAccountDeletionStatusAsync(
                user.UserId,
                adminAuthClient,
                accountDeletionGuard,
                cancellationToken);

            if (!status.CanDelete)
            {
                return status.HasActiveSubscription
                    ? Results.Json(status, statusCode: StatusCodes.Status409Conflict)
                    : Results.Problem(
                        title: "Account deletion unavailable.",
                        detail: status.Message,
                        statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            await profileRepository.DeleteAccountDataAsync(user.UserId, cancellationToken);
            await adminAuthClient.DeleteUserAsync(user.UserId, cancellationToken);

            return Results.NoContent();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(ProfileEndpoints).FullName!);
            logger.LogError(exception, "Unable to delete account.");

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The account deletion request failed.";

            return Results.Problem(
                title: "Unable to delete account.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetGameResultsAsync(
        string universeId,
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        SupabaseAuthClient authClient,
        IProfileRepository profileRepository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var accessToken = ReadBearerToken(httpRequest);

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return Results.Unauthorized();
            }

            var user = await authClient.GetUserAsync(accessToken, cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            var results = await profileRepository.GetGameResultsAsync(universe.Id, user.UserId, cancellationToken);
            return Results.Ok(results);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(ProfileEndpoints).FullName!);
            logger.LogError(exception, "Unable to load game results for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading game results.";

            return Results.Problem(
                title: "Unable to load game results.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<AccountDeletionStatusResponse> BuildAccountDeletionStatusAsync(
        Guid userId,
        SupabaseAdminAuthClient adminAuthClient,
        IAccountDeletionGuard accountDeletionGuard,
        CancellationToken cancellationToken)
    {
        if (!adminAuthClient.IsConfigured)
        {
            return new AccountDeletionStatusResponse(
                false,
                false,
                "Account deletion is unavailable right now. Please contact support.");
        }

        var eligibility = await accountDeletionGuard.GetEligibilityAsync(userId, cancellationToken);

        if (!eligibility.CanDelete)
        {
            return new AccountDeletionStatusResponse(
                false,
                eligibility.HasActiveSubscription,
                eligibility.Message
                ?? "Account deletion is blocked until the account is eligible again.");
        }

        return new AccountDeletionStatusResponse(
            true,
            false,
            eligibility.Message
            ?? "Deleting your account permanently removes your profile, streaks, and leaderboard history.");
    }

    private static string? ReadBearerToken(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Authorization", out var authorizationHeaderValues))
        {
            return null;
        }

        var authorizationHeader = authorizationHeaderValues.ToString();

        if (!authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return authorizationHeader["Bearer ".Length..].Trim();
    }

    private static Dictionary<string, string[]> ValidateUpdate(UpdateProfileRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            errors["displayName"] = ["Display name is required."];
        }

        if (request.AvatarUrl is not null && request.AvatarUrl.Trim().Length > 512)
        {
            errors["avatarUrl"] = ["Avatar url is too long."];
        }

        return errors;
    }
}
