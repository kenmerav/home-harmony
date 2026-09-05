import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveSharedScopeUserId } from '@/lib/householdScope';
import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { buildWalmartCartUrl, CartIngredient, ingredientKey, isSeasoning, isWater, packageCount, parseWalmartId, preferredProduct, cartPackageCount, WalmartProduct, walmartSearch, normalizeSent, pendingCartItems, SentQuantities } from '@/lib/walmartCart';

type Choice = CartIngredient & { included: boolean; product: string; label: string; size: string; count: string; estimated: boolean };
type Saved = { products: Record<string, WalmartProduct>; skipSeasonings: boolean; sentByWeek: Record<string, SentQuantities> };
const settingsPath = ['shared_preferences', 'walmart_cart'];
function normalizeSaved(value: unknown): Saved {
  const data = value as Partial<Saved> | null;
  const products: Record<string, WalmartProduct> = {};
  if (data?.products && typeof data.products === 'object') {
    Object.entries(data.products).forEach(([key, product]) => {
      if (product && typeof product.id === 'string' && parseWalmartId(product.id) && typeof product.label === 'string') products[key] = { id: product.id, label: product.label, size: typeof product.size === 'string' ? product.size : '' };
    });
  }
  const sentByWeek = Object.fromEntries(Object.entries(data?.sentByWeek || {}).filter(([week]) => /^\d{4}-\d{2}-\d{2}$/.test(week)).map(([week, quantities]) => [week, normalizeSent(quantities)]));
  return { products, skipSeasonings: typeof data?.skipSeasonings === 'boolean' ? data.skipSeasonings : true, sentByWeek };
}

export function WalmartCartDialog({ items, userId, weekOf, onClose }: { items: CartIngredient[]; userId: string; weekOf: string; onClose: () => void }) {
  const scope = resolveSharedScopeUserId(userId);
  const cacheKey = `homehub.walmart-cart.v1.${scope}`;
  const sentKey = `${cacheKey}.${weekOf}.opened`;
  const [rows, setRows] = useState<Choice[]>([]);
  const [saved, setSaved] = useState<Saved>(normalizeSaved(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryIds, setRetryIds] = useState<string[]>([]);
  const sendLock = useRef(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let prefs = normalizeSaved(null);
      try { prefs = normalizeSaved(JSON.parse(localStorage.getItem(cacheKey) || 'null')); } catch { /* Empty cache. */ }
      try {
        const value = getProfileSettingsValue(await loadProfileSettingsDocument(scope), settingsPath);
        if (value) {
          const remote = normalizeSaved(value);
          for (const [week, counts] of Object.entries(prefs.sentByWeek)) {
            const merged = { ...remote.sentByWeek[week] };
            for (const [id, count] of Object.entries(counts)) merged[id] = Math.max(merged[id] || 0, count);
            remote.sentByWeek[week] = merged;
          }
          prefs = remote;
        }
      } catch { if (!cancelled) setMessage('Account preferences could not load. Using choices saved on this device.'); }
      if (cancelled) return;
      const choices = items.filter(item => !item.isChecked && !isWater(item.name)).map(item => {
        const product = preferredProduct(item.name, prefs.products[ingredientKey(item.name)]);
        const count = packageCount(item.quantity, product?.size);
        return { ...item, included: !(prefs.skipSeasonings && isSeasoning(item.name)), product: product?.id || '', label: product?.label || '', size: product?.size || '', count: String(cartPackageCount(item, product)), estimated: count === null };
      });
      // Preserve the old session warning while upgrading to a durable per-week record.
      try {
        if (!prefs.sentByWeek[weekOf] && sessionStorage.getItem(sentKey) === 'true') {
          prefs.sentByWeek[weekOf] = Object.fromEntries(pendingCartItems(choices.filter(row => row.included && row.product).map(row => ({ id: row.product, quantity: Number(row.count) })), {}).map(row => [row.id, row.quantity]));
          localStorage.setItem(cacheKey, JSON.stringify(prefs));
        }
      } catch { /* Storage may be unavailable. */ }
      setSaved(prefs);
      setRows(choices);
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
  const sent = saved.sentByWeek[weekOf] || {};
  const selectedProducts = selected.map(row => ({ id: parseWalmartId(row.product)!, quantity: Number(row.count) }));
  const pending = pendingCartItems(selectedProducts, sent, retryIds);
  const hasSent = Object.keys(sent).length > 0;
  let readyUrl = '';
  let cartError = '';
  try { if (pending.length && !invalid) readyUrl = buildWalmartCartUrl(pending); }
  catch (error) { cartError = error instanceof Error ? error.message : 'Check package counts.'; }
  async function saveChoices(override?: Saved) {
    setSaving(true);
    setMessage('');
    try {
      const products = { ...saved.products };
      rows.forEach(row => {
        const id = parseWalmartId(row.product);
        if (id) products[ingredientKey(row.name)] = { id, label: row.label || row.name, size: row.size };
      });
      const next = { ...(override || saved), products };
      let localSaved = false;
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); localSaved = true; } catch { /* Account save still works. */ }
      try { await updateProfileSettingsValue(scope, settingsPath, next); }
      catch { setMessage(localSaved ? 'Choices saved on this device only; account sync failed.' : 'Choices could not be saved. You can still continue to Walmart.'); }
      setSaved(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Check your selections.'); }
    finally { setSaving(false); }
  }
  function recordSelection(openLink: boolean): boolean {
    if (sendLock.current) return false;
    const totals = Object.fromEntries(pendingCartItems(selectedProducts, {}).map(row => [row.id, row.quantity]));
    const nextSent = { ...sent };
    // Recheck this device in case another tab sent items since this dialog opened.
    try {
      const latest = normalizeSaved(JSON.parse(localStorage.getItem(cacheKey) || 'null')).sentByWeek[weekOf] || {};
      for (const [id, count] of Object.entries(latest)) nextSent[id] = Math.max(nextSent[id] || 0, count);
      if (openLink && JSON.stringify(pendingCartItems(selectedProducts, nextSent, retryIds)) !== JSON.stringify(pending)) {
        setSaved(previous => ({ ...previous, sentByWeek: { ...previous.sentByWeek, [weekOf]: nextSent } }));
        setMessage('Another tab updated this week. Review the remaining quantities before sending.');
        return false;
      }
    } catch { /* Account save is attempted below. */ }
    for (const [id, quantity] of Object.entries(totals)) nextSent[id] = Math.max(nextSent[id] || 0, quantity);
    const next = { ...saved, sentByWeek: { ...saved.sentByWeek, [weekOf]: nextSent } };
    try { localStorage.setItem(cacheKey, JSON.stringify(next)); }
    catch { setMessage('This device cannot remember sent items. Check Walmart before sending again.'); }
    sendLock.current = true;
    setSaved(next);
    setRetryIds([]);
    void saveChoices(next).finally(() => { sendLock.current = false; });
    return true;
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
          const next = { ...saved, skipSeasonings };
          setSaved(next);
          void saveChoices(next);
          setRows(previous => previous.map(row => isSeasoning(row.name) ? { ...row, included: !skipSeasonings } : row));
          
        }} />Skip seasonings such as salt, pepper and garlic powder</label>
        <p className="text-xs text-muted-foreground">Checked-off groceries and water are excluded. Your seasoning preference is saved for future weeks.</p>
        {unresolved.length > 0 && <p role="status" className="text-sm text-amber-700">{unresolved.length} items could not be matched and will not be sent: {unresolved.map(row => row.name).join(', ')}. They remain unchecked on your grocery list.</p>}
        {hasSent && <div className="rounded-lg bg-muted p-3 space-y-2 text-sm"><p>This week’s items were previously sent or marked as already in your cart. Only additional quantities are included below. Walmart does not tell this app which items it accepted.</p><p>If something is missing, select “Retry this item” next to that product. This resends only the selected missing items. Adjust the package count first if Walmart added some.</p></div>}
        {readyUrl ? <div className="space-y-2">
          <Button asChild className="w-full" disabled={saving}><a href={readyUrl} target="_blank" rel="noopener noreferrer" onClick={event => {
            if (saving || !recordSelection(true)) event.preventDefault();
          }}>Send {pending.length} matched items to Walmart ↗</a></Button>
          <p className="text-xs text-muted-foreground">Adds to your existing Walmart cart. Check Walmart for missing or unavailable items before checkout. Sending is not confirmation that items were added.</p>
        </div> : <p role="status">{hasSent ? 'No additional items to send. Check Walmart, then retry only anything missing.' : 'No matched items ready.'}</p>}
        {!!selected.length && !invalid && <Button variant="outline" disabled={saving} onClick={() => recordSelection(false)}>Mark selected items as already in Walmart cart</Button>}
        <fieldset disabled={saving} className="space-y-3 min-w-0">
          {rows.map((row, index) => <div key={row.key} className="rounded-lg border p-3 space-y-3">
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={row.included} onChange={event => change(row.key, { included: event.target.checked })} />{row.name}<span className="ml-auto text-sm font-normal text-muted-foreground">{row.quantity}</span></label>
            {row.included && <>
              <p className="text-sm">{row.label || 'No reliable automatic match yet'} {parseWalmartId(row.product) && `— ${row.count} package${row.count === '1' ? '' : 's'}`}</p>
              {sent[parseWalmartId(row.product) || ''] > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={retryIds.includes(parseWalmartId(row.product)!)} onChange={event => { const id = parseWalmartId(row.product)!; setRetryIds(previous => event.target.checked ? [...previous, id] : previous.filter(value => value !== id)); }} />Retry this item — missing from Walmart cart</label>}
              {row.estimated && row.product && <p className="text-xs text-muted-foreground">Estimated package count — check before checkout.</p>}
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
                  const count = cartPackageCount(row, { id: parseWalmartId(row.product) || '', label: row.label, size: event.target.value });
                  change(row.key, { size: event.target.value, count: String(count), estimated: packageCount(row.quantity, event.target.value) === null });
                }} /></label>
                <label className="text-sm">Packages to add<Input type="number" min="1" max="999" step="1" value={row.count} onChange={event => change(row.key, { count: event.target.value, estimated: false })} /></label>
              </div>
              <p className="text-xs text-muted-foreground">{row.estimated ? 'Package count is a best estimate from the recipe. Adjust if needed.' : 'Review the package count against the product size and what you already have.'}</p>
              </details>
            </>}
          </div>)}
        </fieldset>
        {!rows.length && <p>No remaining groceries for this week.</p>}
        {cartError && <p role="alert" className="text-sm text-destructive">{cartError}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </>}
    </DialogContent>
  </Dialog>;
}
