-- Add currency column to spaces and bookings tables

alter table public.spaces
add column if not exists currency text not null default 'MXN';

update public.spaces
set currency = 'MXN'
where currency is null;

alter table public.bookings
add column if not exists currency text not null default 'MXN';

update public.bookings
set currency = 'MXN'
where currency is null;

