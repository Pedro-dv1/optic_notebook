import { LuUserRound as UserRound } from 'react-icons/lu'
import { safeImageUrl } from '../lib/media'

export function ProfileAvatar({ src, name, className = 'size-11' }: { src?: string | null; name: string; className?: string }) {
  const image = safeImageUrl(src || null)
  return image
    ? <img src={image} alt={`Foto de ${name}`} className={`${className} shrink-0 rounded-full object-cover`} />
    : <span className={`${className} grid shrink-0 place-items-center rounded-full bg-[#eaf3fd] text-[#087cf0]`} aria-label={`Avatar de ${name}`}><UserRound className="size-1/2" aria-hidden="true" /></span>
}
