import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { applyRecipeCleanup, readCleanupRecipes } from '@/lib/api/recipeCleanup';
import { CleanupChange, CleanupRecipe, planRecipeCleanup } from '@/lib/recipeCleanup';

export function RecipeCleanupDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [snapshot, setSnapshot] = useState<{ ownerId: string; recipes: CleanupRecipe[] }>();
  const [changes, setChanges] = useState<CleanupChange[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('Scanning recipes…');
  const [busy, setBusy] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readCleanupRecipes().then(result => {
      if (cancelled) return;
      const plan = planRecipeCleanup(result.recipes);
      setSnapshot(result); setChanges(plan); setSelected(plan.map(change => change.recipe.id));
      setMessage(`Scanned ${result.recipes.filter(recipe => recipe.name !== '__No Meal Needed Placeholder__').length} recipes. ${plan.filter(change => change.action === 'delete').length} incomplete; ${plan.filter(change => change.action === 'repair').length} with clear formatting repairs.`);
    }).catch(error => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, []);
  function backup() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'home-harmony-recipes-before-cleanup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setBackedUp(true);
  }
  async function apply() {
    if (!snapshot || busy || done) return;
    setBusy(true);
    try {
      await applyRecipeCleanup(snapshot.ownerId, changes.filter(change => selected.includes(change.recipe.id)), count => setMessage(`Applied ${count} of ${selected.length} changes…`));
      setMessage(`Completed ${selected.length} changes. Your recipe list is updated.`); setDone(true); onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cleanup failed.'); setDone(true); onChanged(); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="sm:max-w-3xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>Review recipe cleanup</DialogTitle><DialogDescription>Remove recipes missing ingredients or instructions, and repair clear ingredient formatting errors. Quantities are preserved; ambiguous ingredient splits still need review.</DialogDescription></DialogHeader>
    <p role="status" className="text-sm">{message}</p>
    <p className="text-sm text-muted-foreground">Deletion is permanent and may remove linked meal-plan entries. Saved foods are unaffected. Download the full recipe backup before applying changes.</p>
    <fieldset disabled={busy || done} className="space-y-3 min-w-0">
      {changes.map(change => <div key={change.recipe.id} className="rounded-lg border p-3">
        <label className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(change.recipe.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, change.recipe.id] : previous.filter(id => id !== change.recipe.id))} /><span><strong>{change.action === 'delete' ? 'Delete' : 'Repair'}: {change.recipe.name}</strong><span className="block text-sm text-muted-foreground">{change.reason}</span></span></label>
        {change.action === 'repair' && <details className="mt-2 text-sm"><summary>Compare ingredients</summary><p className="font-medium mt-2">Before</p><pre className="whitespace-pre-wrap break-words">{Array.isArray(change.recipe.ingredients) ? change.recipe.ingredients.join('\n') : change.recipe.ingredients_raw}</pre><p className="font-medium mt-2">After</p><pre className="whitespace-pre-wrap break-words">{change.ingredients.join('\n')}</pre></details>}
      </div>)}
    </fieldset>
    <Button variant="outline" disabled={!snapshot || busy} onClick={backup}>Download recipe backup</Button>
    <Button variant="destructive" disabled={!backedUp || busy || done || !selected.length} onClick={() => void apply()}>{busy ? 'Applying changes…' : `Apply ${selected.length} selected changes`}</Button>
    <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
  </DialogContent></Dialog>;
}
