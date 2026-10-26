import { useEffect, useState } from 'react'
import { avatarUrl, failedAvatars, initials } from '../../utils/avatar'
import { hashColor } from '../../utils/colors'

interface Props {
  name: string
  email: string
  size: number
  /** ring color (the commit's lane) */
  ring: string
}

/** Author picture in a ring; colored initials underneath show until it loads, or for good when there is none. */
export function Avatar({ name, email, size, ring }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let alive = true
    void avatarUrl(email).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [email])

  return (
    <div
      title={`${name} <${email}>`}
      className="relative flex items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: hashColor(email.toLowerCase()),
        boxShadow: `0 0 0 2px ${ring}`
      }}
    >
      {initials(name)}
      {url && !broken && !failedAvatars.has(url) && (
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={() => {
            failedAvatars.add(url)
            setBroken(true)
          }}
        />
      )}
    </div>
  )
}
