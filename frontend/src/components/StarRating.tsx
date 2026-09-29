import { useState } from 'react'
import { LuStar } from 'react-icons/lu'

export function StarRating() {
  const [rating, setRating] = useState(0)

  return <fieldset>
    <legend className="sr-only">Nota</legend>
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => <label key={value} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg">
        <input className="peer sr-only" type="radio" name="rating" value={value} required checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`} />
        <LuStar className={`size-8 rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#52658a] ${value <= rating ? 'fill-[#f5c518] stroke-none' : 'fill-none text-[#91a0b7]'}`} aria-hidden="true" />
      </label>)}
    </div>
  </fieldset>
}
