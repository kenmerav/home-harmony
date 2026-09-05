import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveSharedScopeUserId } from '@/lib/householdScope';
import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { buildWalmartCartUrl, CartIngredient, ingredientKey, isSeasoning, isWater, packageCount, parseWalmartId, automaticProduct, bestPackageCount, WalmartProduct, walmartSearch } from '@/lib/walmartCart';

type Choice = CartIngredient & { included: boolean; product: string; label: string; size: string; count: string; estimated: boolean };
type Saved = { products: Record<string, WalmartProduct>; skipSeasonings: boolean };
const settingsPath = ['shared_preferences', 'walmart_cart'];
function normalizeSaved(value: unknown): Saved {
  const data = value as Partial<Saved> | null;
  const products: Record<string, WalmartProduct> = {};
  if (data?.products && typeof data.products === 'object') {
    Object.entries(data.products).forEach(([key, product]) => {
      if (product && typeof product.id === 'string' && parseWalmartId(product.id) && typeof product.label === 'string') products[key] = { id: product.id, label: product.label, size: typeof product.size === 'string' ? product.size : '' };
    });
  }
  return { products, skipSeasonings: false };
}

export function WalmartCartDialog({ items, userId, weekOf, onClose }: { items: CartIngredient[]; userId: string; weekOf: string; onClose: () => void }) {
  const scope = resolveSharedScopeUserId(userId);
  const cacheKey = `homehub.walmart-cart.v1.${scope}`;
  const sentKey = `${cacheKey}.${weekOf}.opened`;
  const [rows, setRows] = useState<Choice[]>([]);
  const [saved, setSaved] = useState<Saved>({ products: {}, skipSeasonings: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(() => { try { return sessionStorage.getItem(sentKey) === 'true'; } catch { return false; } });
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let prefs: Saved = { products: {}, skipSeasonings: false };
      try { prefs = normalizeSaved(JSON.parse(localStorage.getItem(cacheKey) || 'null')); } catch { /* Empty cache. */ }
      try {
        const value = getProfileSettingsValue(await loadProfileSettingsDocument(scope), settingsPath);
        if (value) prefs = normalizeSaved(value);
      } catch { if (!cancelled) setMessage('Account preferences could not load. Using choices saved on this device.'); }
      if (cancelled) return;
      setSaved(prefs);
      setRows(items.filter(item => !item.isChecked && !isWater(item.name)).map(item => {
        const product = prefs.products[ingredientKey(item.name)] || automaticProduct(item.name);
        const count = packageCount(item.quantity, product?.size);
        return { ...item, included: true, product: product?.id || '', label: product?.label || '', size: product?.size || '', count: String(bestPackageCount(item.quantity, product?.size)), estimated: count === null };
      }));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
    // The parent mounts a fresh dialog per household/week; the snapshot stays stable during review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, cacheKey]);
  const selected = rows.filter(row => row.included && parseWalmartId(row.product));
  const unresolved = rows.filter(row => row.included && !parseWalmartId(row.product));
  const invalid = selected.some(row => !parseWalmartId(row.product) || !/^\d+$/.test(row.count) || Number(row.count) < 1 || Number(row.count) > 999);
  function change(key: string, patch: Partial<Choice>) {
    setRows(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
  }
  let readyUrl = '';
  let cartError = '';
  try { if (selected.length && !invalid) readyUrl = buildWalmartCartUrl(selected.map(row => ({ id: parseWalmartId(row.product)!, quantity: Number(row.count) }))); }
  catch (error) { cartError = error instanceof Error ? error.message : 'Check package counts.'; }
  async function saveChoices() {
    setSaving(true);
    setMessage('');
    try {
      const products = { ...saved.products };
      rows.forEach(row => {
        const id = parseWalmartId(row.product);
        if (id) products[ingredientKey(row.name)] = { id, label: row.label || row.name, size: row.size };
      });
      const next = { ...saved, products };
      let localSaved = false;
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); localSaved = true; } catch { /* Account save still works. */ }
      try { await updateProfileSettingsValue(scope, settingsPath, next); }
      catch { setMessage(localSaved ? 'Choices saved on this device only; account sync failed.' : 'Choices could not be saved. You can still continue to Walmart.'); }
      setSaved(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Check your selections.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Shop this week at Walmart</DialogTitle>
        <DialogDescription>Week of {weekOf}. Review the unchecked ingredients from your grocery list, including weekly staples. Great Value, lean meat and reduced fat are preferred when choosing products.</DialogDescription>
      </DialogHeader>
      {loading ? <p role="status">Loading your saved products…</p> : <>
        <p className="text-sm text-muted-foreground">Products are chosen automatically from saved choices and known matches. Review or change them if you want. Walmart confirms availability, substitutions and prices.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saved.skipSeasonings} disabled={saving} onChange={event => {
          const skipSeasonings = event.target.checked;
          setSaved(previous => ({ ...previous, skipSeasonings }));
          setRows(previous => previous.map(row => isSeasoning(row.name) ? { ...row, included: !skipSeasonings } : row));
          
        }} />Skip seasonings such as salt, pepper and garlic powder</label>
        <p className="text-xs text-muted-foreground">All unchecked items are included by default, including seasonings. Water is excluded. This sends selected items to Walmart regardless of individual store preferences.</p>
        <fieldset disabled={saving} className="space-y-3 min-w-0">
          {rows.map((row, index) => <div key={row.key} className="rounded-lg border p-3 space-y-3">
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={row.included} onChange={event => change(row.key, { included: event.target.checked })} />{row.name}<span className="ml-auto text-sm font-normal text-muted-foreground">{row.quantity}</span></label>
            {row.included && <>
              <p className="text-sm">{row.label || 'No reliable automatic match yet'} {parseWalmartId(row.product) && `— ${row.count} package${row.count === '1' ? '' : 's'}`}</p>
              <details><summary className="text-sm text-primary cursor-pointer">Change product or quantity (optional)</summary>
              <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
                <a href={walmartSearch(row.name)} target="_blank" rel="noopener noreferrer" className="text-primary underline">Find product at Walmart ↗</a>
                {parseWalmartId(row.product) && <a href={`https://www.walmart.com/ip/${parseWalmartId(row.product)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">View selected product ↗</a>}
              </div>
              {row.label && <p className="text-sm">{row.label}</p>}
              <label className="block text-sm" htmlFor={`product-${index}`}>Walmart product link or item ID</label>
              <Input id={`product-${index}`} value={row.product} placeholder="https://www.walmart.com/ip/…" onChange={event => change(row.key, { product: event.target.value, label: '', size: '', count: '1', estimated: true })} />
              {row.product && !parseWalmartId(row.product) && <p className="text-sm text-destructive">Paste a Walmart product link or numeric item ID.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">Package size (optional)<Input value={row.size} placeholder="e.g. 16 oz, 1 lb, 1 each" onChange={event => {
                  const count = packageCount(row.quantity, event.target.value);
                  change(row.key, { size: event.target.value, count: String(count || 1), estimated: count === null });
                }} /></label>
                <label className="text-sm">Packages to add<Input type="number" min="1" max="999" step="1" value={row.count} onChange={event => change(row.key, { count: event.target.value, estimated: false })} /></label>
              </div>
              <p className="text-xs text-muted-foreground">{row.estimated ? 'Check package count: the recipe amount cannot be converted automatically. Starts at 1 package.' : 'Review the package count against the product size and what you already have.'}</p>
              </details>
            </>}
          </div>)}
        </fieldset>
        {!rows.length && <p>No remaining groceries for this week.</p>}
        {unresolved.length > 0 && <p role="status" className="text-sm text-amber-700">{unresolved.length} items could not be matched and will not be added: {unresolved.map(row => row.name).join(', ')}. They remain unchecked on your grocery list. You can send the matched items now.</p>}
        {cartError && <p role="alert" className="text-sm text-destructive">{cartError}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {opened ? <div className="rounded-lg bg-muted p-3 space-y-2 text-sm"><p>This week’s cart link has already been opened. Check Walmart before sending again to avoid duplicate quantities.</p><Button variant="outline" onClick={() => { setOpened(false);  }}>Review and send again</Button></div> : readyUrl ? <div className="space-y-2">
          <Button asChild className="w-full"><a href={readyUrl} target="_blank" rel="noopener noreferrer" onClick={() => {
            try { sessionStorage.setItem(sentKey, 'true'); } catch { /* Session storage is optional. */ }
            setOpened(true);
            void saveChoices();
          }}>Add {selected.length} matched items to Walmart cart ↗</a></Button>
          <p className="text-xs text-muted-foreground">Adds to your existing Walmart cart. Review Walmart’s result for unavailable items and complete checkout there. This does not mark your groceries ordered.</p>
        </div> : <Button disabled={true} onClick={() => void saveChoices()}>No matched items ready</Button>}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </>}
    </DialogContent>
  </Dialog>;
}
