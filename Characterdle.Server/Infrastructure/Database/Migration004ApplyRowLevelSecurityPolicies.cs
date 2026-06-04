namespace Characterdle.Server.Infrastructure.Database;

public sealed class Migration004ApplyRowLevelSecurityPolicies : IDatabaseMigration
{
    public string Description => "Enable row level security and add read/write policies for public game data and player-owned profile data.";

    public string Id => "004_apply_row_level_security_policies";

    public string Sql =>
        """
        grant usage on schema public to anon, authenticated;
        grant select on public."GOTCharacters" to anon, authenticated;
        grant select on public."GOTGames" to anon, authenticated;
        grant select on public."GOTQuotes" to anon, authenticated;
        grant select, insert, update on public."PlayerProfiles" to authenticated;
        grant select, insert, update on public."UniverseGameResults" to authenticated;

        alter table public."GOTCharacters" enable row level security;
        alter table public."GOTGames" enable row level security;
        alter table public."GOTQuotes" enable row level security;
        alter table public."PlayerProfiles" enable row level security;
        alter table public."UniverseGameResults" enable row level security;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'GOTCharacters'
              and policyname = 'Public read GOTCharacters'
          ) then
            create policy "Public read GOTCharacters"
            on public."GOTCharacters"
            for select
            using (true);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'GOTGames'
              and policyname = 'Public read GOTGames'
          ) then
            create policy "Public read GOTGames"
            on public."GOTGames"
            for select
            using (true);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'GOTQuotes'
              and policyname = 'Public read GOTQuotes'
          ) then
            create policy "Public read GOTQuotes"
            on public."GOTQuotes"
            for select
            using (true);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'PlayerProfiles'
              and policyname = 'Service manage PlayerProfiles'
          ) then
            create policy "Service manage PlayerProfiles"
            on public."PlayerProfiles"
            for all
            to postgres, service_role
            using (true)
            with check (true);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'PlayerProfiles'
              and policyname = 'Users read own PlayerProfiles'
          ) then
            create policy "Users read own PlayerProfiles"
            on public."PlayerProfiles"
            for select
            to authenticated
            using (auth.uid() = user_id);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'PlayerProfiles'
              and policyname = 'Users insert own PlayerProfiles'
          ) then
            create policy "Users insert own PlayerProfiles"
            on public."PlayerProfiles"
            for insert
            to authenticated
            with check (auth.uid() = user_id);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'PlayerProfiles'
              and policyname = 'Users update own PlayerProfiles'
          ) then
            create policy "Users update own PlayerProfiles"
            on public."PlayerProfiles"
            for update
            to authenticated
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'UniverseGameResults'
              and policyname = 'Service manage UniverseGameResults'
          ) then
            create policy "Service manage UniverseGameResults"
            on public."UniverseGameResults"
            for all
            to postgres, service_role
            using (true)
            with check (true);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'UniverseGameResults'
              and policyname = 'Users read own UniverseGameResults'
          ) then
            create policy "Users read own UniverseGameResults"
            on public."UniverseGameResults"
            for select
            to authenticated
            using (auth.uid() = user_id);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'UniverseGameResults'
              and policyname = 'Users insert own UniverseGameResults'
          ) then
            create policy "Users insert own UniverseGameResults"
            on public."UniverseGameResults"
            for insert
            to authenticated
            with check (auth.uid() = user_id);
          end if;
        end
        $$;

        do $$
        begin
          if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'UniverseGameResults'
              and policyname = 'Users update own UniverseGameResults'
          ) then
            create policy "Users update own UniverseGameResults"
            on public."UniverseGameResults"
            for update
            to authenticated
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
          end if;
        end
        $$;
        """;
}
