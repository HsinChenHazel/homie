-- Households
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_color text,
  avatar_initials text,
  household_id uuid references households(id) on delete set null,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  paid_by uuid not null references profiles(id),
  title text not null,
  amount numeric(10,2) not null,
  date date not null default current_date,
  split_type text not null default 'equal' check (split_type in ('equal', 'custom')),
  created_at timestamptz default now()
);

-- Expense splits
create table expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references profiles(id),
  amount_owed numeric(10,2) not null,
  settled boolean not null default false,
  settlement_id uuid references settlements(id) on delete set null
);

-- Chores
create table chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  recurrence text not null default 'weekly' check (recurrence in ('daily', 'weekly', 'none')),
  created_at timestamptz default now()
);

-- Chore assignments
create table chore_assignments (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  user_id uuid not null references profiles(id),
  due_date date not null,
  completed boolean not null default false
);

-- Settlements (initiated by one member, tracks the overall settle-up event)
create table settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'complete')),
  expense_count int not null default 0,
  created_at timestamptz default now()
);

-- Settlement items (one row per payment transfer)
create table settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references settlements(id) on delete cascade,
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  amount numeric(10,2) not null,
  paid_at timestamptz
);

-- Grocery items
create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity text,
  added_by uuid not null references profiles(id),
  checked_off boolean not null default false,
  created_at timestamptz default now()
);

-- Row Level Security
alter table households enable row level security;
alter table profiles enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table chores enable row level security;
alter table chore_assignments enable row level security;
alter table grocery_items enable row level security;

-- Policies: users can only see data in their household
create policy "household members only" on households
  for all using (
    id = (select household_id from profiles where id = auth.uid())
  );

create policy "own profile or same household" on profiles
  for select using (
    id = auth.uid() or
    household_id = (select household_id from profiles where id = auth.uid())
  );

create policy "own profile update" on profiles
  for update using (id = auth.uid());

create policy "household members" on expenses
  for all using (
    household_id = (select household_id from profiles where id = auth.uid())
  );

create policy "household members" on expense_splits
  for all using (
    expense_id in (
      select id from expenses where
      household_id = (select household_id from profiles where id = auth.uid())
    )
  );

create policy "household members" on chores
  for all using (
    household_id = (select household_id from profiles where id = auth.uid())
  );

create policy "household members" on chore_assignments
  for all using (
    chore_id in (
      select id from chores where
      household_id = (select household_id from profiles where id = auth.uid())
    )
  );

create policy "household members" on grocery_items
  for all using (
    household_id = (select household_id from profiles where id = auth.uid())
  );

-- Grocery history (unique item names per household)
create table grocery_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  last_added_at timestamptz not null default now(),
  unique(household_id, name)
);

alter table grocery_history enable row level security;

create policy "household members" on grocery_history
  for all using (
    household_id = (select household_id from profiles where id = auth.uid())
  );

alter table settlements enable row level security;
alter table settlement_items enable row level security;

create policy "household members" on settlements
  for all using (
    household_id = (select household_id from profiles where id = auth.uid())
  );

create policy "household members" on settlement_items
  for all using (
    settlement_id in (
      select id from settlements where
      household_id = (select household_id from profiles where id = auth.uid())
    )
  );

-- Allow debtors to mark their own items paid
create policy "debtor can update own item" on settlement_items
  for update using (from_user_id = auth.uid());
