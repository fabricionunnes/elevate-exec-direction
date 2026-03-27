/**
 * Converts a URL into an embeddable URL for iframe playback.
 * Returns null if the URL can't be embedded (e.g. private Google Drive files).
 */
export function getEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

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

  return null;
}

export function isDirectVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function isGoogleDrive(url: string | null | undefined): boolean {
  if (!url) return false;
  return /drive\.google\.com/i.test(url);
}

/**
 * Gets the Google Drive direct download/view URL for opening in a new tab.
 */
export function getGoogleDriveViewUrl(url: string): string {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/view`;
  }
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/file/d/${openMatch[1]}/view`;
  }
  return url;
}
