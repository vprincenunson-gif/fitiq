import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWardrobe } from '../stores/WardrobeContext'
import { useOutfit } from '../stores/OutfitContext'
import { ItemDetailPanel } from '../components/wardrobe/ItemDetailPanel'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'

export function ItemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { garmentById, updateGarment, removeGarment } = useWardrobe()
  const { addToOutfit } = useOutfit()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const garment = id ? garmentById(id) : undefined

  if (!garment) {
    return (
      <EmptyState
        icon="hanger"
        headline="Item not found"
        copy="It may have been removed from your wardrobe."
        action={
          <Link to="/wardrobe">
            <Button variant="ghost">Back to wardrobe</Button>
          </Link>
        }
      />
    )
  }

  const handleAddToOutfit = () => {
    addToOutfit({ id: garment.id, category: garment.category })
    navigate('/try-on')
  }

  const handleDelete = () => {
    removeGarment(garment.id)
    setConfirmDelete(false)
    navigate('/wardrobe')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="surface overflow-hidden rounded-2xl">
        <div className="img-shell flex aspect-[4/5] items-center justify-center bg-cream/40 p-6">
          <img
            src={garment.image}
            alt={garment.name}
            className="h-full w-full object-contain transition-transform duration-500 ease-editorial"
          />
        </div>
      </div>

      <ItemDetailPanel
        garment={garment}
        onUpdate={(patch) => updateGarment(garment.id, patch)}
        onDelete={() => setConfirmDelete(true)}
        onAddToOutfit={handleAddToOutfit}
      />

      <Dialog open={confirmDelete} title="Remove this item?" onClose={() => setConfirmDelete(false)}>
        <p className="text-sm text-ink-soft">
          {garment.name} will be removed from your wardrobe. This can’t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button onClick={handleDelete}>
            <Icon name="trash" size={16} />
            Remove
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
