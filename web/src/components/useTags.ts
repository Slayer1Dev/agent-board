import { useEffect, useState } from 'react'
import { api, type Tag } from '../api'

/** Tags do quadro, recarregadas quando o quadro muda (`versao`). */
export function useTags(versao: string) {
  const [tags, setTags] = useState<Tag[]>([])
  useEffect(() => {
    let ativo = true
    api.tags().then(t => { if (ativo) setTags(t) }).catch(() => { /* a lista anterior continua valendo */ })
    return () => { ativo = false }
  }, [versao])
  return tags
}
