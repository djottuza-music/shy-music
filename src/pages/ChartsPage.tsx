import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { listPublishedTracks } from '../lib/catalog'

type Region = 'zambia' | 'africa' | 'world'

const africanCountries = new Set([
  'algeria','angola','benin','botswana','burkina faso','burundi','cabo verde','cameroon','central african republic','chad','comoros','congo','democratic republic of the congo','djibouti','egypt','equatorial guinea','eritrea','eswatini','ethiopia','gabon','gambia','ghana','guinea','guinea-bissau','ivory coast','kenya','lesotho','liberia','libya','madagascar','malawi','mali','mauritania','mauritius','morocco','mozambique','namibia','niger','nigeria','rwanda','senegal','seychelles','sierra leone','somalia','south africa','south sudan','sudan','tanzania','togo','tunisia','uganda','zambia','zimbabwe',
])

function inRegion(country: string | null | undefined, region: Region) {
  if (region === 'world') return true
  const normalized = country?.trim().toLocaleLowerCase() ?? ''
  return region === 'zambia' ? normalized === 'zambia' : africanCountries.has(normalized)
}

export function ChartsPage() {
  const [region, setRegion] = useState<Region>('world')
  const query = useQuery({ queryKey: ['tracks', 'charts'], queryFn: () => listPublishedTracks(100) })
  const tracks = useMemo(() => (query.data ?? []).filter((track) => inRegion(track.artist?.country, region)).slice(0, region === 'zambia' ? 50 : 100), [query.data, region])

  if (query.isLoading) return <LoadingState label="Building the charts..." />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />

  return <div><div className="page-heading"><div><span className="eyebrow"><BarChart3 />SHY Charts</span><h1>The music moving now</h1><p>Ranked by qualifying streams from published music.</p></div><div className="chart-tabs" role="group" aria-label="Chart region">{(['zambia','africa','world'] as Region[]).map((value) => <button key={value} className={region === value ? 'active' : ''} onClick={() => setRegion(value)}>{value}</button>)}</div></div>{tracks.length ? <div className="track-list chart-list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} queue={tracks} index={index} />)}</div> : <EmptyState title={`No ${region === 'world' ? 'global' : region} chart yet`} text="Published music appears here as listeners complete qualifying plays." />}</div>
}
