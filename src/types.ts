export type Role = 'listener' | 'artist' | 'admin'
export type ReleaseStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface Profile {
  id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  roles: Role[]
}

export interface Artist {
  id: string
  user_id: string
  display_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  country: string | null
  verified: boolean
  followers_count: number
  tags: string[]
  motivation_phone: string | null
  is_active: boolean
}

export interface Album {
  id: string
  artist_id: string
  title: string
  slug: string
  cover_path: string | null
  cover_url?: string | null
  release_type: 'album' | 'ep' | 'single'
  release_status: ReleaseStatus
  release_at: string | null
  created_at: string
  artist?: Pick<Artist, 'display_name' | 'slug' | 'avatar_url' | 'verified'>
  track_count?: number
}

export interface Track {
  id: string
  artist_id: string
  album_id: string | null
  title: string
  slug: string
  audio_path: string
  cover_path: string | null
  cover_url?: string | null
  duration_seconds: number
  track_number: number | null
  genre: string | null
  mood: string | null
  lyrics: string | null
  explicit: boolean
  downloadable: boolean
  release_status: ReleaseStatus
  release_at: string | null
  plays_count: number
  created_at: string
  artist?: Pick<Artist, 'display_name' | 'slug' | 'avatar_url' | 'verified'>
  album?: Pick<Album, 'title' | 'slug' | 'cover_path'> | null
  stream_url?: string
}

export interface Playlist {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
}
