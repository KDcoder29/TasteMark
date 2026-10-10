import { supabase } from './supabase'
import { norm } from './shared'

// A place in a group is ONE card for everybody: find it by name + city.
export async function findGroupPlace(groupId, name, city) {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, city, dishes(id, name, dish_ratings(user_id))')
    .eq('group_id', groupId)
  if (error) throw error
  return (data || []).find(p => norm(p.name) === norm(name) && norm(p.city) === norm(city)) || null
}

// Adds a dish to a group place together with MY rating.
// If a dish with the same name already exists there, my rating is added to it instead.
// existing = the place's current dishes (with dish_ratings(user_id)).
// overwrite=false: do nothing if I already rated that dish.
export async function addDishWithRating(placeId, d, me, existing, { overwrite = true } = {}) {
  const found = (existing || []).find(x => norm(x.name) === norm(d.name))
  let dishId = found?.id
  let status = 'created'

  if (found) {
    const mine = (found.dish_ratings || []).some(r => r.user_id === me)
    if (mine && !overwrite) return { status: 'already', dishId }
    status = mine ? 'updated' : 'rated'
  } else {
    const { data, error } = await supabase.from('dishes').insert({
      place_id: placeId, name: d.name.trim(),
      price: d.price === '' || d.price == null ? null : +d.price,
    }).select('id').single()
    if (error) throw error
    dishId = data.id
  }

  const { error } = await supabase.from('dish_ratings').upsert({
    dish_id: dishId, user_id: me, rating: d.rating,
    order_again: d.order_again || null, note: (d.note || '').trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'dish_id,user_id' })
  if (error) {
    if (status === 'created') await supabase.from('dishes').delete().eq('id', dishId)  // no half-saved dish
    throw error
  }
  return { status, dishId, name: d.name.trim() }
}
