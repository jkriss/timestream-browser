function createObjects(acc, p) {
  // rel="next" => 1: rel 2: next
  var m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
  if (m) acc[m[1]] = m[2];
  return acc;
}

function parseLink(link) {
  var m = link.match(/<?([^>]*)>(.*)/),
    linkUrl = m && m[1],
    parts = m && m[2] && m[2].split(";");
  if (parts) {
    parts.shift();
    var info = parts.reduce(createObjects, {});
    info.url = linkUrl;
    return info;
  }
}

export default function parseLinkHeader(header) {
  if (!header) return [];
  return header.split(/,\s*</).map(parseLink);
}