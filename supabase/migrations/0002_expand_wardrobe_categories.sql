-- ─────────────────────────────────────────────────────────────────────────────
-- Expand wardrobe categories (gender-inclusive, no gender field)
--
-- Purely additive: existing rows already use one of the original ids
-- (shirt / pants / shoes), which remain valid, so no data is rewritten,
-- renamed or dropped. Safe to run more than once, and safe to run before
-- 0001 (it becomes a no-op when the table does not exist yet).
--
-- Run after 0001 in the Supabase SQL editor, or with `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.wardrobe_items') is null then
    raise notice 'wardrobe_items does not exist yet — run 0001 first';
    return;
  end if;

  alter table public.wardrobe_items
    drop constraint if exists wardrobe_items_category_check;

  alter table public.wardrobe_items
    add constraint wardrobe_items_category_check check (
      category in (
        'shirt', 'blouse', 'top', 'pants', 'jeans', 'skirt',
        'dress', 'jumpsuit', 'ethnic', 'shoes', 'accessory'
      )
    );
end
$$;
