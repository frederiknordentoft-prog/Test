// "Skift spiller" on the map (review P1-1): with two or more children the child's own letter sits in
// the top bar, and a tap goes back to "Hvem skal spille?" — no gate, because switching is harmless
// (adding and deleting a child stay behind the gate on the picker). The round on the shelf, if any,
// is already stored; the child is written and unloaded first, like the picker at app start.
import { useNav } from '../../../../app/nav'
import { useSession } from '../../../../state/useSession'

export async function switchPlayer(): Promise<void> {
  await useSession.getState().leaveProfile()
  useNav.getState().root({ id: 'profiles' }, 'back')
}
