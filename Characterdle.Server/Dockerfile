FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Characterdle.Server/Characterdle.Server.csproj", "Characterdle.Server/"]
RUN dotnet restore "Characterdle.Server/Characterdle.Server.csproj"

COPY . .
WORKDIR /src/Characterdle.Server
RUN dotnet publish "Characterdle.Server.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 10000

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "Characterdle.Server.dll"]
