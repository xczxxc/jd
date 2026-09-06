export type Role = 'boy' | 'girl'

export type Profile = {
  id: Role
  display_name: string
  avatar_url: string | null
  bio: string | null
}

export type Message = {
  id: string
  sender: Role
  kind: 'text' | 'image' | 'audio' | 'call'
  body: string | null
  media_url: string | null
  media_path: string | null
  duration: number | null
  reply_to: string | null
  reply_snip: string | null
  reaction: string | null
  read_at: string | null
  created_at: string
}

export type Moment = {
  id: string
  url: string
  path: string
  caption: string | null
  uploaded_by: Role
  width: number | null
  height: number | null
  bytes: number | null
  original_bytes: number | null
  created_at: string
}

export type Period = {
  id: string
  start_date: string
  end_date: string | null
  flow: 'ringan' | 'sedang' | 'berat' | null
  note: string | null
}

export type CoupleEvent = {
  id: string
  title: string
  date: string
  kind: 'agenda' | 'anniversary' | 'ulangtahun' | 'date'
  note: string | null
  created_by: Role
}
