// index.js
const axios = require('axios');
const {
  fbdown, ttdl, igdl,
  mediafire, capcut, gdrive, pinterest
} = require('btch-downloader');

const DEFAULT_AUTHOR = "ItachiCodes";

async function fetchYouTube(url) {
  const apiRes = await axios.get(`https://min-ytdl.vercel.app/api/download?url=${encodeURIComponent(url)}`);
  const d = apiRes.data || {};
  return {
    download_url: d.download_url || d.alternative_urls?.[0]?.url || null,
    raw: d
  };
}

async function fetchFacebook(url) {
  const d = await fbdown(url);
  return {
    download_url: d?.HD || d?.SD || null,
    raw: d
  };
}

async function fetchTikTok(url) {
  const d = await ttdl(url);
  const video = Array.isArray(d?.video) ? d.video[0] : d?.video || null;
  return {
    download_url: video,
    raw: d
  };
}

async function fetchInstagram(url) {
  const d = await igdl(url);
  // igdl often returns result array with url(s)
  const dl = d?.result?.[0]?.url || d?.url || null;
  return {
    download_url: dl,
    raw: d
  };
}

async function fetchMediaFire(url) {
  const d = await mediafire(url);
  // sample response you provided: result.url OR url at top-level
  const dl = d?.result?.url || d?.url || d?.downloadUrl || null;
  return {
    download_url: dl,
    filename: d?.result?.filename || d?.filename,
    filesize: d?.result?.filesize || d?.filesize,
    mimetype: d?.result?.mimetype || d?.mimetype,
    raw: d
  };
}

async function fetchCapCut(url) {
  const d = await capcut(url);
  // sample fields: title, originalVideoUrl, coverUrl, authorName
  return {
    download_url: d?.originalVideoUrl || d?.videoUrl || d?.result?.video_url || null,
    title: d?.title || d?.result?.title || null,
    cover: d?.coverUrl || d?.cover || null,
    author: d?.authorName || d?.author || null,
    raw: d
  };
}

async function fetchGDrive(url) {
  const d = await gdrive(url);
  // sample: data.downloadUrl
  const dl = d?.data?.downloadUrl || d?.downloadUrl || d?.result?.downloadUrl || null;
  return {
    download_url: dl,
    filename: d?.data?.filename || d?.result?.filename || d?.filename || null,
    filesize: d?.data?.filesize || d?.filesize || null,
    raw: d
  };
}

async function fetchPinterest(urlOrQuery) {
  const d = await pinterest(urlOrQuery);
  // sample: result.image OR result.video_url OR image field
  const img = d?.result?.image || d?.image || d?.result?.images?.[0] || d?.result?.video_url || null;
  return {
    download_url: img,
    is_video: !!(d?.result?.is_video || d?.result?.video_url),
    raw: d
  };
}

async function getDownloadFor(url) {
  // normalize
  const u = String(url || '').trim();

  if (!u) throw new Error('Missing url');

  if (u.includes('youtube.com') || u.includes('youtu.be')) return { platform: 'YouTube', ...(await fetchYouTube(u)) };
  if (u.includes('facebook.com') || u.includes('fb.watch')) return { platform: 'Facebook', ...(await fetchFacebook(u)) };
  if (u.includes('tiktok.com')) return { platform: 'TikTok', ...(await fetchTikTok(u)) };
  if (u.includes('instagram.com')) return { platform: 'Instagram', ...(await fetchInstagram(u)) };

  // other supported services (MediaFire, CapCut, GDrive, Pinterest)
  if (u.includes('mediafire.com')) return { platform: 'MediaFire', ...(await fetchMediaFire(u)) };
  if (u.includes('capcut.com')) return { platform: 'CapCut', ...(await fetchCapCut(u)) };
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) return { platform: 'GoogleDrive', ...(await fetchGDrive(u)) };
  if (u.includes('pin.it') || u.includes('pinterest.com') || u.startsWith('http') && u.includes('pinterest')) return { platform: 'Pinterest', ...(await fetchPinterest(u)) };

  // If user passed a plain search term (useful for pinterest search)
  // Treat any non-URL short text as a pinterest query
  if (!u.startsWith('http')) {
    return { platform: 'Pinterest', ...(await fetchPinterest(u)) };
  }

  throw new Error('Unsupported platform');
}

module.exports = async (req, res) => {
  try {
    // root info
    if (req.url === '/' || req.url.startsWith('/?')) {
      res.status(200).json({
        success: true,
        author: DEFAULT_AUTHOR,
        message: "Unified Video/File/Image Downloader API",
        endpoints: { download: "/api/download?url={URL_OR_QUERY}" },
        platforms: ["YouTube","Facebook","TikTok","Instagram","MediaFire","CapCut","GoogleDrive","Pinterest"]
      });
      return;
    }

    const url = req.query?.url;
    if (!url) {
      res.status(400).json({ success: false, error: "Missing url parameter" });
      return;
    }

    const result = await getDownloadFor(url);

    if (!result?.download_url) {
      res.status(502).json({
        success: false,
        author: DEFAULT_AUTHOR,
        platform: result?.platform || null,
        error: "Download URL not found",
        raw: result?.raw || null
      });
      return;
    }

    res.status(200).json({
      success: true,
      author: DEFAULT_AUTHOR,
      platform: result.platform,
      download_url: result.download_url,
      meta: {
        title: result.title || result.filename || null,
        filesize: result.filesize || null,
        cover: result.cover || null,
        author_name: result.author || null,
        is_video: result.is_video || null
      },
      raw: result.raw
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      author: DEFAULT_AUTHOR,
      error: err?.message || String(err)
    });
  }
};
