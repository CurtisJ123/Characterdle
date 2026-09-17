-- Run manually in STAGING after the original Episode Ladder schema.
-- Preserves existing puzzles and account progress at their original numeric difficulty.
-- 1 Easy, 2 Medium, 3 Hard, 4 Expert, 5 Impossible.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Suspend deferred row-count checks while backfilling/changing the composite keys.
drop trigger episode_ladder_game_has_five_events on public."GOTEpisodeLadderGames";
drop trigger episode_ladder_event_count_valid on public."GOTEpisodeLadderGameEvents";

alter table public."GOTEpisodeLadderGameEvents" add column difficulty smallint;
update public."GOTEpisodeLadderGameEvents" e set difficulty = g.difficulty
from public."GOTEpisodeLadderGames" g where g.game_id = e.game_id;
alter table public."GOTEpisodeLadderGameEvents" alter column difficulty set not null;

alter table public."GOTEpisodeLadderGameEvents"
    drop constraint "GOTEpisodeLadderGameEvents_game_id_fkey",
    drop constraint "GOTEpisodeLadderGameEvents_pkey",
    drop constraint "GOTEpisodeLadderGameEvents_game_id_correct_position_key",
    drop constraint "GOTEpisodeLadderGameEvents_game_id_initial_position_key";
alter table public."GOTEpisodeLadderGames" drop constraint "GOTEpisodeLadderGames_pkey",
    add primary key (game_id, difficulty);
alter table public."GOTEpisodeLadderGameEvents"
    add primary key (game_id, difficulty, event_id),
    add unique (game_id, difficulty, correct_position),
    add unique (game_id, difficulty, initial_position),
    add foreign key (game_id, difficulty) references public."GOTEpisodeLadderGames" (game_id, difficulty) on delete cascade;

create or replace function public.check_episode_ladder_event_count()
returns trigger language plpgsql set search_path = '' as $$
declare
    affected record;
    event_count integer;
    unchanged_positions integer;
begin
    for affected in
        select (case when tg_op <> 'INSERT' then old.game_id end) as game_id,
               (case when tg_op <> 'INSERT' then old.difficulty end) as difficulty
        union
        select (case when tg_op <> 'DELETE' then new.game_id end),
               (case when tg_op <> 'DELETE' then new.difficulty end)
    loop
        if exists (select 1 from public."GOTEpisodeLadderGames"
                   where game_id = affected.game_id and difficulty = affected.difficulty) then
            select count(*), count(*) filter (where correct_position = initial_position)
            into event_count, unchanged_positions from public."GOTEpisodeLadderGameEvents"
            where game_id = affected.game_id and difficulty = affected.difficulty;
            if event_count <> 5 or unchanged_positions = 5 then
                raise exception 'Each Episode Ladder difficulty must have five shuffled events.' using errcode = '23514';
            end if;
        end if;
    end loop;
    return null;
end;
$$;

create table public."GOTEpisodeLadderProgress" (
    user_id uuid not null references public."PlayerProfiles" (user_id) on delete cascade,
    game_id bigint not null,
    difficulty smallint not null,
    attempts jsonb not null,
    status text not null check (status in ('playing', 'won', 'lost')),
    updated_at timestamptz not null default now(),
    primary key (user_id, game_id, difficulty),
    foreign key (game_id, difficulty) references public."GOTEpisodeLadderGames" (game_id, difficulty) on delete cascade,
    check (public.episode_ladder_attempt_count(attempts) between 0 and 4),
    check ((status = 'playing' and jsonb_array_length(attempts) < 4)
        or (status = 'won' and jsonb_array_length(attempts) between 1 and 4)
        or (status = 'lost' and jsonb_array_length(attempts) = 4))
);
insert into public."GOTEpisodeLadderProgress" (user_id, game_id, difficulty, attempts, status, updated_at)
select r.user_id, r.game_id, g.difficulty, r.episode_ladder_attempts, r.status, r.updated_at
from public."UniverseGameResults" r join public."GOTEpisodeLadderGames" g on g.game_id = r.game_id
where r.universe_id = 'got' and r.mode = 'episode_ladder';

alter table public."GOTEpisodeLadderProgress" enable row level security;
revoke all on public."GOTEpisodeLadderProgress" from public, anon, authenticated;
grant select, insert, update, delete on public."GOTEpisodeLadderProgress" to service_role;
create policy episode_ladder_progress_service on public."GOTEpisodeLadderProgress"
for all to service_role using (true) with check (true);

create constraint trigger episode_ladder_game_has_five_events
after insert or update on public."GOTEpisodeLadderGames" deferrable initially deferred
for each row execute function public.check_episode_ladder_event_count();
create constraint trigger episode_ladder_event_count_valid
after insert or update or delete on public."GOTEpisodeLadderGameEvents" deferrable initially deferred
for each row execute function public.check_episode_ladder_event_count();

commit;
