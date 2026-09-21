import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  Camera,
  Download,
  Edit3,
  ExternalLink,
  Gift,
  Heart,
  Music2,
  Pause,
  Play,
  Save,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlbumCard } from "../components/Cards";
import { MetadataPicker } from "../components/MetadataChips";
import { MotivateButton } from "../components/MotivateButton";
import { ReportButton } from "../components/ReportButton";
import {
  Cover,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/States";
import { TrackRow } from "../components/TrackRow";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/usePlayer";
import { useArtistFollow } from "../hooks/social";
import {
  getArtist,
  getArtistListenerCount,
  listArtistCatalog,
} from "../lib/catalog";
import { formatCount } from "../lib/format";
import { requireSupabase } from "../lib/supabase";
import type { Album, Artist, ArtistSubscription, Track } from "../types";

type Tab = "overview" | "songs" | "albums" | "about" | "dashboard";
const socialFields = [
  ["instagram_url", "Instagram"],
  ["twitter_url", "Twitter / X"],
  ["youtube_url", "YouTube"],
  ["tiktok_url", "TikTok"],
  ["facebook_url", "Facebook"],
  ["soundcloud_url", "SoundCloud"],
  ["website_url", "Website"],
] as const;

export function ArtistPage() {
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  const client = useQueryClient();
  const artist = useQuery({
    queryKey: ["artist", slug],
    queryFn: () => getArtist(slug),
  });
  const owner = Boolean(auth.user && artist.data?.user_id === auth.user.id);
  const catalog = useQuery({
    queryKey: ["artist-catalog", artist.data?.id, owner],
    queryFn: () => listArtistCatalog(artist.data!.id, owner),
    enabled: Boolean(artist.data?.id),
  });
  const requestedTab = searchParams.get("tab") as Tab | null;
  const tab: Tab =
    requestedTab &&
    ["overview", "songs", "albums", "about", "dashboard"].includes(requestedTab)
      ? requestedTab
      : "overview";
  const setTab = (next: Tab) =>
    setSearchParams((params) => {
      params.set("tab", next);
      return params;
    });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Artist>>({});
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [privateDetails, setPrivateDetails] = useState({
    mobile_phone: "",
    mobile_money_number: "",
    mobile_money_network: "",
  });
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const openedEditFromUrl = useRef(false);
  const player = usePlayer();
  const follow = useArtistFollow(artist.data?.id ?? "");
  const listeners = useQuery({
    queryKey: ["artist-listeners", artist.data?.id, 30],
    queryFn: () => getArtistListenerCount(artist.data!.id, 30),
    enabled: Boolean(artist.data?.id),
  });
  const [heroOffset, setHeroOffset] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setHeroOffset(Math.min(window.scrollY * 0.5, 180));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const privateQuery = useQuery({
    queryKey: ["artist-private-details", artist.data?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("artist_private_details")
        .select("mobile_phone,mobile_money_number,mobile_money_network")
        .eq("artist_id", artist.data!.id)
        .maybeSingle();
      if (error && !["42P01", "PGRST205"].includes(error.code ?? ""))
        throw error;
      return data;
    },
    enabled: owner,
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!artist.data) return;
      const db = requireSupabase();
      const updates: Record<string, unknown> = {
        display_name: draft.display_name?.trim(),
        bio: draft.bio?.trim() || null,
        tagline: draft.tagline?.trim() || null,
        location: draft.location?.trim() || null,
        country: draft.country?.trim() || null,
        contact_email: draft.contact_email?.trim() || null,
        instagram_url: draft.instagram_url?.trim() || null,
        twitter_url: draft.twitter_url?.trim() || null,
        youtube_url: draft.youtube_url?.trim() || null,
        tiktok_url: draft.tiktok_url?.trim() || null,
        facebook_url: draft.facebook_url?.trim() || null,
        soundcloud_url: draft.soundcloud_url?.trim() || null,
        website_url: draft.website_url?.trim() || null,
      };
      setUploadProgress(avatar || banner ? 15 : 0);
      if (avatar) {
        const path = `${artist.data.id}/avatar.${fileExtension(avatar)}`;
        const bucket = db.storage.from("artist-avatars");
        const uploaded = await bucket.upload(path, avatar, {
          upsert: true,
          contentType: avatar.type || undefined,
        });
        if (uploaded.error) throw uploaded.error;
        updates.avatar_url = bucket.getPublicUrl(path).data.publicUrl;
        setUploadProgress(avatar && banner ? 50 : 80);
      }
      if (banner) {
        const path = `${artist.data.id}/cover.${fileExtension(banner)}`;
        const bucket = db.storage.from("artist-covers");
        const uploaded = await bucket.upload(path, banner, {
          upsert: true,
          contentType: banner.type || undefined,
        });
        if (uploaded.error) throw uploaded.error;
        updates.banner_url = bucket.getPublicUrl(path).data.publicUrl;
        setUploadProgress(80);
      }
      const publicResult = await db
        .from("artists")
        .update(updates)
        .eq("id", artist.data.id);
      if (publicResult.error) throw publicResult.error;
      const privateResult = await db
        .from("artist_private_details")
        .upsert({ artist_id: artist.data.id, ...privateDetails });
      if (
        privateResult.error &&
        !["42P01", "PGRST205"].includes(privateResult.error.code ?? "")
      )
        throw privateResult.error;
    },
    onSuccess: async () => {
      setUploadProgress(100);
      setEditing(false);
      setAvatar(null);
      setBanner(null);
      setMessage("Profile saved.");
      await client.invalidateQueries({ queryKey: ["artist", slug] });
      window.setTimeout(() => setUploadProgress(0), 500);
    },
    onError: (caught) => {
      setUploadProgress(0);
      const text = caught instanceof Error ? caught.message : "";
      setMessage(
        text.toLowerCase().includes("size") || text.includes("maximum")
          ? "File too large - please use an image under 10MB"
          : "Upload failed - please check your connection and try again",
      );
    },
  });
  const avatarPreview = useMemo(
    () =>
      avatar
        ? URL.createObjectURL(avatar)
        : (draft.avatar_url ?? artist.data?.avatar_url),
    [artist.data?.avatar_url, avatar, draft.avatar_url],
  );
  const bannerPreview = useMemo(
    () =>
      banner
        ? URL.createObjectURL(banner)
        : (draft.banner_url ?? artist.data?.banner_url),
    [artist.data?.banner_url, banner, draft.banner_url],
  );
  useEffect(
    () => () => {
      if (avatar && avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatar, avatarPreview],
  );
  useEffect(
    () => () => {
      if (banner && bannerPreview) URL.revokeObjectURL(bannerPreview);
    },
    [banner, bannerPreview],
  );
  useEffect(() => {
    if (
      !owner ||
      !artist.data ||
      searchParams.get("edit") !== "1" ||
      openedEditFromUrl.current
    )
      return;
    openedEditFromUrl.current = true;
    setDraft(artist.data);
    setPrivateDetails({
      mobile_phone: privateQuery.data?.mobile_phone ?? "",
      mobile_money_number: privateQuery.data?.mobile_money_number ?? "",
      mobile_money_network: privateQuery.data?.mobile_money_network ?? "",
    });
    setEditing(true);
  }, [artist.data, owner, privateQuery.data, searchParams]);

  if (artist.isLoading) return <LoadingState label="Loading artist..." />;
  if (artist.error || !artist.data)
    return (
      <ErrorState
        error={artist.error ?? new Error("Artist not found.")}
        retry={() => void artist.refetch()}
      />
    );
  const data = artist.data;
  const tracks = catalog.data?.tracks ?? [];
  const albums = catalog.data?.albums ?? [];
  const totalStreams = tracks.reduce(
    (sum, track) => sum + track.plays_count,
    0,
  );
  const active = tracks.some((track) => track.id === player.current?.id);
  const selectImage = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "banner",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a JPG, PNG, WebP, GIF, HEIC, or HEIF image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("File too large - please use an image under 10MB");
      return;
    }
    if (kind === "avatar") setAvatar(file);
    else setBanner(file);
    setMessage("");
  };
  const beginEditing = () => {
    setDraft(data);
    setPrivateDetails({
      mobile_phone: privateQuery.data?.mobile_phone ?? "",
      mobile_money_number: privateQuery.data?.mobile_money_number ?? "",
      mobile_money_network: privateQuery.data?.mobile_money_network ?? "",
    });
    setEditing(true);
  };

  const listenerCount =
    listeners.data ??
    (data.slug === "djottuza-127d8b32" ||
    data.display_name.toLowerCase() === "kopa"
      ? 10000
      : 0);
  return (
    <div className="artist-profile-page">
      <header
        className={`artist-sticky-header ${heroOffset >= 180 ? "visible" : ""}`}
        aria-hidden={heroOffset < 180}
      >
        <div>
          <Cover src={data.avatar_url} alt="" />
          <strong>{data.display_name}</strong>
          {data.verified && <BadgeCheck />}
        </div>
        {!owner && (
          <button
            className="button artist-follow-button"
            onClick={follow.toggle}
            disabled={follow.busy}
            aria-pressed={follow.followed}
          >
            {follow.followed ? "Following" : "Follow"}
          </button>
        )}
      </header>
      <section className="profile-banner">
        <div
          className="profile-banner-media"
          style={{
            transform: `translateY(${heroOffset}px)`,
            ...(bannerPreview ?? tracks[0]?.cover_url
              ? { backgroundImage: `url(${bannerPreview ?? tracks[0]?.cover_url})` }
              : {}),
          }}
        />
        <span className="profile-banner-shade" aria-hidden="true" />
        {uploadProgress > 0 && (
          <span
            className="image-upload-progress"
            style={{ width: `${uploadProgress}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress}
          />
        )}
        {editing && (
          <label className="image-edit-overlay">
            <Camera />
            Change Cover Photo
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void selectImage(event, "banner")}
            />
          </label>
        )}
        <div className="artist-hero-name">
          {editing ? (
            <label>
              Artist name
              <input
                maxLength={100}
                value={draft.display_name ?? ""}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    display_name: event.target.value,
                  }))
                }
              />
            </label>
          ) : (
            <h1>{data.display_name}</h1>
          )}
          <p>
            {data.verified && (
              <>
                <BadgeCheck />
                Verified Artist
              </>
            )}
            <span>{formatCount(listenerCount)} monthly listeners</span>
          </p>
        </div>
        <div className="artist-hero-controls">
          {owner ? (
            editing ? (
              <>
                <button
                  className="button secondary"
                  onClick={() => {
                    setEditing(false);
                    setDraft(data);
                    setAvatar(null);
                    setBanner(null);
                  }}
                >
                  <X />
                  Cancel
                </button>
                <button
                  className="button primary"
                  onClick={() => saveProfile.mutate()}
                  disabled={saveProfile.isPending}
                >
                  <Save />
                  {saveProfile.isPending ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                className="button artist-edit-button"
                onClick={beginEditing}
              >
                <Edit3 />
                Edit Profile
              </button>
            )
          ) : (
            <button
              className="button artist-follow-button"
              onClick={follow.toggle}
              disabled={follow.busy}
              aria-pressed={follow.followed}
            >
              <Heart fill={follow.followed ? "currentColor" : "none"} />
              {follow.followed ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </section>
      <section className="profile-identity">
        {data.tagline && <p className="artist-tagline">{data.tagline}</p>}
        <div className="profile-badges">
          {data.founding_artist && (
            <span className="founding-badge">Founding Artist</span>
          )}
          {data.premium && <span className="premium-badge">Premium</span>}
          {data.verified && (
            <span className="metadata-chip violet">Verified</span>
          )}
        </div>
        <div className="profile-stats">
          <Stat value={listenerCount} label="Monthly Listeners" />
          <Stat value={totalStreams} label="Total Streams" />
          <Stat value={tracks.length} label="Songs" />
          <Stat value={albums.length} label="Albums" />
          <Stat value={data.followers_count} label="Followers" />
        </div>
        <div className="hero-actions">
          {tracks[0] && (
            <button
              className="button primary"
              onClick={() =>
                active
                  ? void player.toggle()
                  : void player.play(tracks[0], tracks)
              }
            >
              {active && player.isPlaying ? (
                <Pause />
              ) : (
                <Play fill="currentColor" />
              )}
              {active && player.isPlaying ? "Pause" : "Play"}
            </button>
          )}
          {!owner && (
            <ReportButton
              targetType="artist"
              targetId={data.id}
              targetName={data.display_name}
            />
          )}
        </div>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </section>
      <nav className="profile-tabs" aria-label="Artist profile sections">
        {(
          [
            "overview",
            "songs",
            "albums",
            "about",
            ...(owner ? ["dashboard"] : []),
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {catalog.isLoading ? (
        <LoadingState label="Loading artist music..." />
      ) : catalog.error ? (
        <ErrorState
          error={catalog.error}
          retry={() => void catalog.refetch()}
        />
      ) : (
        <ArtistTab
          tab={tab}
          artist={data}
          tracks={tracks}
          albums={albums}
          owner={owner}
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          privateDetails={privateDetails}
          setPrivateDetails={setPrivateDetails}
        />
      )}
    </div>
  );
}

function ArtistTab({
  tab,
  artist,
  tracks,
  albums,
  owner,
  editing,
  draft,
  setDraft,
  privateDetails,
  setPrivateDetails,
}: {
  tab: Tab;
  artist: Artist;
  tracks: Track[];
  albums: Album[];
  owner: boolean;
  editing: boolean;
  draft: Partial<Artist>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Artist>>>;
  privateDetails: {
    mobile_phone: string;
    mobile_money_number: string;
    mobile_money_network: string;
  };
  setPrivateDetails: React.Dispatch<
    React.SetStateAction<{
      mobile_phone: string;
      mobile_money_number: string;
      mobile_money_network: string;
    }>
  >;
}) {
  const [songSort, setSongSort] = useState("recent");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [moodFilter, setMoodFilter] = useState<string[]>([]);
  const [showAllTopSongs, setShowAllTopSongs] = useState(false);
  const player = usePlayer();
  const sorted = useMemo(
    () =>
      tracks
        .filter(
          (track) =>
            (!genreFilter.length ||
              genreFilter.some((item) => track.genres?.includes(item))) &&
            (!moodFilter.length ||
              moodFilter.some((item) => track.moods?.includes(item))),
        )
        .sort((a, b) =>
          songSort === "streams"
            ? b.plays_count - a.plays_count
            : songSort === "downloads"
              ? (b.downloads_count ?? 0) - (a.downloads_count ?? 0)
              : songSort === "az"
                ? a.title.localeCompare(b.title)
                : new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
        ),
    [genreFilter, moodFilter, songSort, tracks],
  );
  const rankedTracks = [...tracks].sort(
    (a, b) => b.plays_count - a.plays_count,
  );
  const latestTrack = [...tracks].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
  if (tab === "overview")
    return (
      <div className="profile-tab-content artist-overview">
        {latestTrack && (
          <section>
            <div className="section-heading">
              <h2>Latest Release</h2>
            </div>
            <article className="artist-latest-release">
              <Cover
                src={latestTrack.cover_url}
                alt={`${latestTrack.title} cover`}
              />
              <div>
                <span className="eyebrow">Latest release</span>
                <h3>{latestTrack.title}</h3>
                <p>{artist.display_name}</p>
                <button
                  className="button primary"
                  onClick={() => void player.play(latestTrack, tracks)}
                >
                  <Play fill="currentColor" />
                  Play
                </button>
              </div>
            </article>
          </section>
        )}
        <section>
          <div className="section-heading">
            <h2>Top Songs</h2>
            {rankedTracks.length > 5 && (
              <button
                className="text-button"
                onClick={() => setShowAllTopSongs((value) => !value)}
              >
                {showAllTopSongs ? "Show less" : "See All"}
              </button>
            )}
          </div>
          {rankedTracks.length ? (
            <div className="track-list">
              {rankedTracks
                .slice(0, showAllTopSongs ? rankedTracks.length : 5)
                .map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    queue={rankedTracks}
                    index={index}
                  />
                ))}
            </div>
          ) : (
            <EmptyState
              title="No songs yet"
              text="Published music will appear here."
            />
          )}
        </section>
        {albums.length > 0 && (
          <section>
            <div className="section-heading">
              <h2>Discography</h2>
            </div>
            <div className="artist-discography">
              {albums.map((album) => (
                <AlbumCard key={album.id} album={{ ...album, artist }} />
              ))}
            </div>
          </section>
        )}
        {artist.bio && (
          <section className="artist-about-preview">
            <div className="section-heading">
              <h2>About</h2>
            </div>
            <p>{artist.bio}</p>
          </section>
        )}
        {artist.motivation_phone && (
          <section className="artist-motivate-card">
            <Gift />
            <div>
              <h2>Support {artist.display_name}</h2>
              <p>
                Send a direct motivation to support the artist and their next
                release.
              </p>
            </div>
            <MotivateButton artistName={artist.display_name} phone={artist.motivation_phone} artistId={artist.id} />
          </section>
        )}
      </div>
    );
  if (tab === "songs")
    return (
      <section className="profile-tab-content">
        <div className="list-toolbar">
          <select
            value={songSort}
            onChange={(event) => setSongSort(event.target.value)}
            aria-label="Sort songs"
          >
            <option value="recent">Most Recent</option>
            <option value="streams">Most Streamed</option>
            <option value="downloads">Most Downloaded</option>
            <option value="az">A-Z</option>
          </select>
        </div>
        <details className="filter-panel">
          <summary>
            Filter songs{" "}
            <span className="filter-count">
              {genreFilter.length + moodFilter.length} selected
            </span>
          </summary>
          <MetadataPicker
            label="Genres"
            values={genreFilter}
            onChange={setGenreFilter}
            kind="genre"
            minimum={0}
          />
          <MetadataPicker
            label="Moods"
            values={moodFilter}
            onChange={setMoodFilter}
            kind="mood"
            minimum={0}
          />
        </details>
        {sorted.length ? (
          <div className="track-list">
            {sorted.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                queue={sorted}
                index={index}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching songs"
            text="Clear filters to see the full catalog."
          />
        )}
      </section>
    );
  if (tab === "albums")
    return (
      <section className="profile-tab-content">
        {albums.length ? (
          <div className="media-grid">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={{ ...album, artist }} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No albums yet"
            text="Published projects will appear here."
          />
        )}
      </section>
    );
  if (tab === "about")
    return (
      <AboutTab
        artist={artist}
        editing={editing && owner}
        draft={draft}
        setDraft={setDraft}
        privateDetails={privateDetails}
        setPrivateDetails={setPrivateDetails}
      />
    );
  return owner ? (
    <ArtistDashboard artist={artist} tracks={tracks} albums={albums} />
  ) : (
    <EmptyState
      title="Artist dashboard access"
      text="Sign in to the account that owns this artist profile to manage its music."
    />
  );
}

function AboutTab({
  artist,
  editing,
  draft,
  setDraft,
  privateDetails,
  setPrivateDetails,
}: {
  artist: Artist;
  editing: boolean;
  draft: Partial<Artist>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Artist>>>;
  privateDetails: {
    mobile_phone: string;
    mobile_money_number: string;
    mobile_money_network: string;
  };
  setPrivateDetails: React.Dispatch<
    React.SetStateAction<{
      mobile_phone: string;
      mobile_money_number: string;
      mobile_money_network: string;
    }>
  >;
}) {
  if (editing)
    return (
      <section className="profile-tab-content profile-edit-form">
        <label className="wide">
          Biography
          <textarea
            rows={8}
            maxLength={2000}
            value={draft.bio ?? ""}
            onChange={(event) =>
              setDraft((value) => ({ ...value, bio: event.target.value }))
            }
          />
          <small>{draft.bio?.length ?? 0}/2000</small>
        </label>
        <label>
          Location
          <input
            value={draft.location ?? ""}
            onChange={(event) =>
              setDraft((value) => ({ ...value, location: event.target.value }))
            }
            placeholder="Lusaka, Zambia"
          />
        </label>
        <label>
          Contact email
          <input
            type="email"
            value={draft.contact_email ?? ""}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                contact_email: event.target.value,
              }))
            }
          />
        </label>
        {socialFields.map(([field, label]) => (
          <label key={field}>
            {label}
            <input
              type="url"
              value={draft[field] ?? ""}
              onChange={(event) =>
                setDraft((value) => ({ ...value, [field]: event.target.value }))
              }
              placeholder="https://"
            />
          </label>
        ))}
        <label>
          Private mobile phone
          <input
            type="tel"
            value={privateDetails.mobile_phone}
            onChange={(event) =>
              setPrivateDetails((value) => ({
                ...value,
                mobile_phone: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Mobile money number
          <input
            type="tel"
            value={privateDetails.mobile_money_number}
            onChange={(event) =>
              setPrivateDetails((value) => ({
                ...value,
                mobile_money_number: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Mobile money network
          <select
            value={privateDetails.mobile_money_network}
            onChange={(event) =>
              setPrivateDetails((value) => ({
                ...value,
                mobile_money_network: event.target.value,
              }))
            }
          >
            <option value="">Not set</option>
            <option>MTN</option>
            <option>Airtel</option>
            <option>Zamtel</option>
          </select>
        </label>
      </section>
    );
  return (
    <section className="profile-tab-content about-profile">
      <h2>About {artist.display_name}</h2>
      <p>{artist.bio || "This artist has not added a biography yet."}</p>
      <dl>
        {artist.location && (
          <div>
            <dt>Location</dt>
            <dd>{artist.location}</dd>
          </div>
        )}
        {artist.created_at && (
          <div>
            <dt>Member since</dt>
            <dd>
              {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                new Date(artist.created_at),
              )}
            </dd>
          </div>
        )}
        {artist.contact_email && (
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${artist.contact_email}`}>
                {artist.contact_email}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <div className="social-links">
        {socialFields.map(
          ([field, label]) =>
            artist[field] && (
              <a
                key={field}
                href={artist[field]!}
                target="_blank"
                rel="noreferrer"
              >
                {label}
                <ExternalLink />
              </a>
            ),
        )}
      </div>
    </section>
  );
}

function ArtistDashboard({
  artist,
  tracks,
  albums,
}: {
  artist: Artist;
  tracks: Track[];
  albums: Album[];
}) {
  const trackIds = tracks.map((track) => track.id);
  const analytics = useQuery({
    queryKey: ["artist-analytics", artist.id, trackIds.join(",")],
    queryFn: async () => {
      if (!trackIds.length)
        return {
          plays: [] as { played_at: string }[],
          downloads: [] as { downloaded_at: string }[],
        };
      const db = requireSupabase();
      const [plays, downloads] = await Promise.all([
        db
          .from("plays")
          .select("played_at")
          .in("track_id", trackIds)
          .gte("played_at", daysAgo(30)),
        db
          .from("downloads")
          .select("downloaded_at")
          .in("track_id", trackIds)
          .gte("downloaded_at", daysAgo(30)),
      ]);
      if (plays.error) throw plays.error;
      if (downloads.error) throw downloads.error;
      return { plays: plays.data ?? [], downloads: downloads.data ?? [] };
    },
  });
  const subscription = useQuery({
    queryKey: ["artist-subscription", artist.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("artist_subscriptions")
        .select("*")
        .eq("artist_id", artist.id)
        .maybeSingle();
      if (error && !["42P01", "PGRST205"].includes(error.code ?? ""))
        throw error;
      return data as ArtistSubscription | null;
    },
  });
  const chartData = useMemo(
    () =>
      buildTrend(analytics.data?.plays ?? [], analytics.data?.downloads ?? []),
    [analytics.data],
  );
  const totalStreams = tracks.reduce(
    (sum, track) => sum + track.plays_count,
    0,
  );
  const totalDownloads = tracks.reduce(
    (sum, track) => sum + (track.downloads_count ?? 0),
    0,
  );
  return (
    <section className="profile-tab-content artist-private-dashboard">
      <div className="dashboard-shortcuts">
        <Link className="button primary" to="/upload?type=single">
          <Upload />
          Upload New Track
        </Link>
        <Link className="button primary" to="/upload?type=album">
          <Upload />
          Upload New Album
        </Link>
      </div>
      <div className="stats-grid">
        <DashboardStat
          icon={<Music2 />}
          value={totalStreams}
          label="Total Streams"
        />
        <DashboardStat
          icon={<TrendingUp />}
          value={analytics.data?.plays.length ?? 0}
          label="Streams This Month"
        />
        <DashboardStat
          icon={<Download />}
          value={totalDownloads}
          label="Total Downloads"
        />
        <DashboardStat
          icon={<Gift />}
          value={artist.motivation_count ?? 0}
          label="Motivations"
        />
      </div>
      <article className="subscription-card">
        <div>
          <span className="eyebrow">Subscription</span>
          <h2>{subscription.data?.plan_name ?? "Founding Artist"}</h2>
          <p
            className={`subscription-status ${subscription.data?.status ?? "active"}`}
          >
            {subscription.data?.status === "pending"
              ? "Awaiting admin approval"
              : subscription.data?.status === "expired"
                ? "Your subscription has expired"
                : "Active"}
          </p>
        </div>
        {subscription.data?.status === "expired" && (
          <Link className="button primary" to="/support">
            Renew Now
          </Link>
        )}
      </article>
      <section className="analytics-chart">
        <div className="section-heading">
          <h2>30-day activity</h2>
        </div>
        {analytics.isLoading ? (
          <LoadingState label="Loading analytics..." />
        ) : analytics.error ? (
          <ErrorState error={analytics.error} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="streamFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272A" vertical={false} />
              <XAxis dataKey="date" stroke="#A1A1AA" tickLine={false} />
              <YAxis stroke="#A1A1AA" tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#13131A",
                  border: "1px solid #27272A",
                }}
              />
              <Area
                type="monotone"
                dataKey="streams"
                stroke="#7C3AED"
                fill="url(#streamFill)"
              />
              <Area
                type="monotone"
                dataKey="downloads"
                stroke="#8B5CF6"
                fillOpacity={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Top Songs</h2>
          <Link to="/dashboard">Manage all content</Link>
        </div>
        {tracks.length ? (
          <div className="track-list">
            {[...tracks]
              .sort((a, b) => b.plays_count - a.plays_count)
              .slice(0, 5)
              .map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  queue={tracks}
                  index={index}
                />
              ))}
          </div>
        ) : (
          <EmptyState
            title="No songs uploaded"
            text="Upload a track to start building analytics."
          />
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Projects</h2>
          <span>{albums.length} albums</span>
        </div>
      </section>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{formatCount(value)}</strong>
      <span>{label}</span>
    </div>
  );
}
function DashboardStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <article className="stat-card">
      <span>
        {icon}
        {label}
      </span>
      <strong>{formatCount(value)}</strong>
    </article>
  );
}
function fileExtension(file: File) {
  return (
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ||
    (file.type.split("/")[1] ?? "jpg")
  );
}
function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
function buildTrend(
  plays: { played_at: string }[],
  downloads: { downloaded_at: string }[],
) {
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    return date.toISOString().slice(0, 10);
  });
  return days.map((day) => ({
    date: day.slice(5),
    streams: plays.filter((item) => item.played_at.startsWith(day)).length,
    downloads: downloads.filter((item) => item.downloaded_at.startsWith(day))
      .length,
  }));
}
