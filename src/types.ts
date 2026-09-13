export type Role = 'listener' | 'artist' | 'admin'
export type ReleaseStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface Profile {
  id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  is_admin: boolean
  is_platform_verified: boolean
  roles: Role[]
}

export interface Artist {
  id: string
  user_id: string
  display_name: string
  slug: string
  bio: string | null
  tagline?: string | null
  avatar_url: string | null
  banner_url: string | null
  country: string | null
  location?: string | null
  verified: boolean
  founding_artist?: boolean
  premium?: boolean
  followers_count: number
  tags: string[]
  motivation_phone: string | null
  motivation_count?: number
  instagram_url?: string | null
  twitter_url?: string | null
  youtube_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  soundcloud_url?: string | null
  website_url?: string | null
  contact_email?: string | null
  is_active: boolean
  created_at?: string
}

export interface Album {
  id: string
  artist_id: string
  title: string
  slug: string
  cover_path: string | null
  cover_url?: string | null
  release_type: 'album' | 'ep' | 'single' | 'mixtape' | 'compilation'
  release_status: ReleaseStatus
  release_at: string | null
  scheduled_at?: string | null
  genres?: string[]
  moods?: string[]
  featured_artists?: string[]
  description?: string | null
  total_tracks?: number
  total_duration_seconds?: number
  created_at: string
  artist?: Pick<Artist, 'display_name' | 'slug' | 'avatar_url' | 'verified'> & Partial<Pick<Artist, 'country' | 'motivation_phone' | 'motivation_count'>>
  track_count?: number
  stream_count?: number
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
  genres?: string[]
  moods?: string[]
  featured_artists?: string[]
  ai_tool?: string | null
  bpm?: number | null
  key_signature?: string | null
  description?: string | null
  custom_tags?: string[]
  lyrics: string | null
  explicit: boolean
  downloadable: boolean
  release_status: ReleaseStatus
  release_at: string | null
  scheduled_at?: string | null
  plays_count: number
  downloads_count?: number
  is_bonus?: boolean
  created_at: string
  artist?: Pick<Artist, 'display_name' | 'slug' | 'avatar_url' | 'verified'> & Partial<Pick<Artist, 'country' | 'motivation_phone' | 'motivation_count'>>
  album?: Pick<Album, 'title' | 'slug' | 'cover_path'> | null
  stream_url?: string
}

export interface Comment {
  id: string
  track_id: string | null
  album_id: string | null
  user_id: string
  body: string
  created_at: string
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>
}

export interface ArtistSubscription {
  artist_id: string
  plan_name: string
  status: 'active' | 'pending' | 'expired'
  renews_at: string | null
  expires_at: string | null
}

export interface Playlist {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
}
