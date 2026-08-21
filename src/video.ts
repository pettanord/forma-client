// Client-safe — no server imports. Mirrors forma-cms lib/video-embed.ts
// and the /api/courses/lesson response (the cross-repo contract: a change
// on either side updates both repos in one breath).

/** A video reference as Forma serves it — lesson API responses and the
 *  anon-readable lesson/course rows both fit this shape. */
export interface FormaVideo {
  /** 'vimeo' | 'youtube' | 'ott' — treat unknown values as Vimeo. */
  video_provider?: string | null;
  video_id?: string | null;
  /**
   * Ready-to-render player URL from /api/courses/lesson. For 'ott' this is
   * the ONLY playable form — a per-viewer authorization (~1 h) minted by
   * the API — so there is never a static URL to build client-side.
   */
  embed_url?: string | null;
  /** Legacy Vimeo column, still set for Vimeo rows. */
  vimeo_id?: string | null;
}

/**
 * The iframe src for a Forma video, or null when there is nothing to play
 * (no video, or an OTT video whose per-viewer URL wasn't minted).
 *
 * Vimeo: player.vimeo.com with dnt=1; the unlisted "id/hash" form becomes
 * ?h=<hash> (the player rejects the path form). YouTube: the nocookie host
 * with rel=0, so finished lessons don't turn into unrelated video tips.
 */
export function videoEmbedSrc(video: FormaVideo | null | undefined): string | null {
  if (!video) return null;

  if (video.video_provider === "ott") return video.embed_url ?? null;

  const videoId = video.video_id ?? video.vimeo_id;
  if (!videoId) return video.embed_url ?? null;

  if (video.video_provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  }

  const [id, hash] = videoId.split("/");
  return `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}dnt=1`;
}
