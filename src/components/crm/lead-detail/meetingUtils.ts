/**
 * Converts a Google Drive (or other) URL into an embeddable URL for iframe playback.
 * Returns null if the URL can't be converted.
 */
export function getEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Google Drive file link: /file/d/ID/...
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Google Drive open link: /open?id=ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  }

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([^?#]+)/);
  if (loomMatch) {
    return `https://www.loom.com/embed/${loomMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Direct video file (mp4, webm, etc.) — can't embed via iframe, return null
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
    return url; // will use <video> tag instead
  }

  return null;
}

export function isDirectVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
