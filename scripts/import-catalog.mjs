import { createClient } from '@supabase/supabase-js'
import { parseFile } from 'music-metadata'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { loadEnvFile } from 'node:process'

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file)
}

const sourceRoot = process.env.SHY_CATALOG_SOURCE || 'D:\\KOPA MUSIC'
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ownerEmail = process.env.ARTIST_EMAIL || 'djottuza@gmail.com'

if (!supabaseUrl || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.')
if (!existsSync(sourceRoot)) throw new Error(`Catalog source does not exist: ${sourceRoot}`)

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const albums = [
  {
    title: 'Bits and Pieces',
    slug: 'bits-and-pieces',
    cover: join(sourceRoot, 'ALBUM-BITS and PIECES', 'photo_2026-04-26_01-43-42.jpg'),
    tracks: [
      ['BAMBAM!', 'DJ Ottuza ft Kopa- BAMBAM!.mp3'],
      ['How Fast They Forget', 'DJ_Ottuza___Kopa-How_fast_they_forget(256k).mp3'],
      ['Say Sorry', 'DJ_Ottuza_ft_Kays_and_Ezz-Say_Sorry__P2_(256k).mp3'],
      ['Abuser', 'DJ_Ottuza_ft_Kopa-Abuser(256k).mp3'],
      ['I Took a Fall', 'DJ_Ottuza_ft_Kopa-I_took_a_fall(256k).mp3'],
      ['I Tried', 'DJ_Ottuza_Ft_Kopa-I_tried(256k).mp3'],
      ["If You Don't Know Love", 'DJ_Ottuza_ft_Kopa-If_you_dont_know_love(256k).mp3'],
      ['Mans Gone', 'DJ_Ottuza_ft_Kopa-Mans_Gone(256k).mp3'],
      ['Nshilabila', 'DJ_Ottuza_ft_Kopa-NSHILABILA(256k).mp3'],
      ['Open Your Eyes', 'DJ_Ottuza_ft_Kopa-Open_your_Eyes(256k).mp3'],
      ['Sembe!', 'DJ_Ottuza_ft_Kopa-SEMBE!(256k).mp3'],
      ['Wake Up!', 'DJ_Ottuza-Wake_Up!(256k).mp3'],
    ],
    directory: 'ALBUM-BITS and PIECES',
  },
  {
    title: "If It Wasn't for Given",
    slug: 'if-it-wasnt-for-given',
    cover: join(sourceRoot, 'ALBUM-IF IT WASNT FOR GIVEN', 'IF IT WASNT.png'),
    tracks: [
      ['A Movie', 'A Movie.mp3'],
      ['Amai Fulawa', 'Amai-Fulawa.mp3'],
      ['Chintonfwa', 'CHiNtonFWA.mp3'],
      ['Hear Me Cry', 'DJ Ottuza & Kopa-Hear me Cry.mp3'],
      ['Wikaluba', 'Dj Ottuza & Kopa-Wikaluba.mp3'],
      ['Gelo', 'GELO.mp3'],
      ['Are You Kidding Me?', 'KOPA & DJ Ottuza-Are you KIDDING mE_ (1).mp3'],
      ['Can I?', 'Kopa & DJ Ottuza-Can I_.mp3'],
      ['Come Back Already', 'Kopa & DJ Ottuzza-Come Back Already.mp3'],
      ['Life Is Not a Movie', 'Kopa & DJ Ottuzza-LifeIsNotAmOvie.mp3'],
      ['Smoking Paper (Remix)', 'SMOKING PAPER (Remix).mp3'],
      ['So She Said (Ensha!)', 'So She Said (ENSHA!) (1).mp3'],
    ],
    directory: 'ALBUM-IF IT WASNT FOR GIVEN',
  },
]

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function findUser(email) {
  let page = 1
  while (page <= 20) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (user) return user
    if (data.users.length < 100) break
    page += 1
  }
  throw new Error(`Create and verify the SHY account for ${email} before importing the catalog.`)
}

async function upload(bucket, path, source) {
  if (!existsSync(source)) throw new Error(`Missing source file: ${source}`)
  const extension = extname(source).toLowerCase()
  const contentTypes = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
  const { error } = await db.storage.from(bucket).upload(path, readFileSync(source), { upsert: true, contentType: contentTypes[extension] || 'application/octet-stream' })
  if (error) throw error
}

const owner = await findUser(ownerEmail)
await db.from('profiles').upsert({ id: owner.id, display_name: 'KOPA & DJ Ottuza' })
await db.from('user_roles').upsert([
  { user_id: owner.id, role: 'listener' },
  { user_id: owner.id, role: 'artist' },
  { user_id: owner.id, role: 'admin' },
])

let { data: artist, error: artistError } = await db.from('artists').select('*').eq('user_id', owner.id).maybeSingle()
if (artistError) throw artistError
if (!artist) {
  const result = await db.from('artists').insert({ user_id: owner.id, display_name: 'KOPA & DJ Ottuza', slug: 'kopa-dj-ottuza', verified: true, followers_count: 18000, country: 'Zambia', tags: ['Afropop', 'Songwriter', 'AI-assisted music'] }).select().single()
  if (result.error) throw result.error
  artist = result.data
} else {
  const result = await db.from('artists').update({ display_name: 'KOPA & DJ Ottuza', slug: 'kopa-dj-ottuza', verified: true, followers_count: Math.max(Number(artist.followers_count || 0), 18000), country: artist.country || 'Zambia' }).eq('id', artist.id).select().single()
  if (result.error) throw result.error
  artist = result.data
}

const releaseAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
for (const albumInput of albums) {
  const coverPath = `${artist.id}/albums/${albumInput.slug}${extname(albumInput.cover).toLowerCase()}`
  await upload('covers', coverPath, albumInput.cover)
  const albumResult = await db.from('albums').upsert({ artist_id: artist.id, title: albumInput.title, slug: albumInput.slug, cover_path: coverPath, release_type: 'album', release_status: 'published', release_at: releaseAt }, { onConflict: 'slug' }).select().single()
  if (albumResult.error) throw albumResult.error
  for (const [index, [title, fileName]] of albumInput.tracks.entries()) {
    const source = join(sourceRoot, albumInput.directory, fileName)
    const trackSlug = `${albumInput.slug}-${slugify(title)}`
    const audioPath = `${artist.id}/tracks/${trackSlug}${extname(source).toLowerCase()}`
    await upload('audio', audioPath, source)
    const metadata = await parseFile(source)
    const result = await db.from('tracks').upsert({ artist_id: artist.id, album_id: albumResult.data.id, title, slug: trackSlug, audio_path: audioPath, cover_path: coverPath, duration_seconds: Math.round(metadata.format.duration || 0), track_number: index + 1, genre: 'Afropop', downloadable: true, release_status: 'published', release_at: releaseAt }, { onConflict: 'slug' })
    if (result.error) throw result.error
    console.log(`Imported ${albumInput.title} / ${title}`)
  }
}

console.log(`Catalog import complete for ${ownerEmail}: ${albums.length} albums, ${albums.reduce((sum, album) => sum + album.tracks.length, 0)} tracks.`)
