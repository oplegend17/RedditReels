export function getRedditHlsUrl(url) {
  if (!url) return null;
  if (url.includes('v.redd.it')) {
    // Extract video ID: https://v.redd.it/xxxxxxx/DASH_720.mp4 or similar
    const match = url.match(/v\.redd\.it\/([^/]+)/);
    if (match) {
      return `https://v.redd.it/${match[1]}/HLSPlaylist.m3u8`;
    }
  }
  return url;
}

export function isRedditUrl(url) {
  return url && url.includes('v.redd.it');
}

export function isRedgifsUrl(url) {
  return url && url.includes('redgifs.com');
}

export function getRedgifsId(url) {
  if (!url) return null;
  // Patterns like https://www.redgifs.com/watch/id or https://redgifs.com/ifr/id
  const match = url.match(/redgifs\.com\/(watch|ifr|get)\/([^/?#]+)/) || url.match(/redgifs\.com\/([^/?#]+)$/);
  return match ? match[2] : null;
}
