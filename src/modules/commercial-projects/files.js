// Commercial Projects · file storage helpers (private bucket, <org>/<project>/<folder>/<file>).
import { supabase } from '../../utils/supabase'

export const BUCKET = 'commercial-projects'

const safe = (s) => String(s || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)

export async function uploadFiles(orgId, projectId, folder, fileList) {
  const out = []
  for (const f of Array.from(fileList || [])) {
    const path = `${orgId}/${projectId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe(f.name)}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined })
    if (error) return { error: error.message, files: out }
    out.push({ path, name: f.name, type: f.type || '', size: f.size })
  }
  return { files: out }
}

export async function openFile(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) { alert(error?.message || 'Could not open the file.'); return }
  window.open(data.signedUrl, '_blank', 'noopener')
}

export async function signedUrls(paths) {
  if (!paths.length) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  return Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]))
}

export async function removeFile(path) {
  await supabase.storage.from(BUCKET).remove([path])
}
