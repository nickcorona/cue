// Cook mode: recipes and cook sessions. Pure helpers; tools.js wraps them and lib/cookui.js
// is the kitchen screen.
//
// state.cook = {
//   recipes: [{ id, name, serves, minutes?, protein_g?, ingredients: [{ name, qty?, unit?, note?, store? }],
//               steps: [{ text, timer_min? }], notes?, archived? }],
//   cooks: [{ id, recipe_id, servings, date, started, finished?, timers: [{ step, label, ends }],
//             routine_id?, step_id?, rating?, note? }],
// }

export function cookState(state) {
  state.cook ||= { recipes: [], cooks: [] };
  state.cook.recipes ||= [];
  state.cook.cooks ||= [];
  return state.cook;
}

export function normalizeRecipe(r, prev = {}) {
  const out = { ...prev, ...r };
  out.serves = Math.max(1, Math.round(out.serves || 1));
  out.ingredients = (out.ingredients || []).filter(i => i && i.name).map(i => ({
    name: i.name, ...(i.qty != null ? { qty: +i.qty } : {}), ...(i.unit ? { unit: i.unit } : {}),
    ...(i.note ? { note: i.note } : {}), ...(i.store ? { store: i.store } : {}),
  }));
  out.steps = (out.steps || []).filter(s => s && s.text).map(s => ({ text: s.text, ...(s.timer_min ? { timer_min: +s.timer_min } : {}) }));
  return out;
}

// The most recent finished cook of a recipe, for "last time" notes.
export function lastCook(cook, recipeId) {
  for (let i = cook.cooks.length - 1; i >= 0; i--) {
    const c = cook.cooks[i];
    if (c.recipe_id === recipeId && c.finished) return { date: c.date, rating: c.rating ?? null, note: c.note || null, servings: c.servings };
  }
  return null;
}

export function recipeOut(cook, r) {
  const last = lastCook(cook, r.id);
  return { ...r, times_cooked: cook.cooks.filter(c => c.recipe_id === r.id && c.finished).length, ...(last ? { last } : {}) };
}

export function cookOut(cook, c) {
  const r = cook.recipes.find(x => x.id === c.recipe_id);
  return { ...c, recipe: r ? recipeOut(cook, r) : null };
}
