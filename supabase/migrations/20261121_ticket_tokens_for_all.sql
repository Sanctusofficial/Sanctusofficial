-- Every registration gets a private ticket token, so every approved guest has a
-- QR code. Previously only the register route set one, so older rows had none.
alter table public.registrations
  alter column ticket_token set default encode(extensions.gen_random_bytes(32), 'hex');

update public.registrations
set ticket_token = encode(extensions.gen_random_bytes(32), 'hex')
where ticket_token is null;
