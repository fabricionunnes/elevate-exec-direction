-- staff_registrations só pra equipe ativa. O link público lê e envia por função (migração anterior).
-- Antes: SELECT e INSERT abertos pra qualquer visitante, UPDATE aberto em cadastro pendente e "Staff can
-- view all" valendo pra qualquer usuário logado (inclusive cliente do portal).
drop policy if exists "Anyone can view by token" on public.staff_registrations;
drop policy if exists "Anyone can create a registration" on public.staff_registrations;
drop policy if exists "Anyone can update a pending registration" on public.staff_registrations;
drop policy if exists "Staff can view all registrations" on public.staff_registrations;
drop policy if exists "Staff can delete registrations" on public.staff_registrations;

create policy "Equipe le cadastros" on public.staff_registrations for select to authenticated using ((select public.gv_is_staff()));
create policy "Equipe cria cadastros" on public.staff_registrations for insert to authenticated with check ((select public.gv_is_staff()));
create policy "Equipe altera cadastros" on public.staff_registrations for update to authenticated using ((select public.gv_is_staff())) with check ((select public.gv_is_staff()));
create policy "Equipe apaga cadastros" on public.staff_registrations for delete to authenticated using ((select public.gv_is_staff()));
