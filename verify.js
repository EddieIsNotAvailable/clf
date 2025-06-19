if (!args || args.length < 2 || !bytesArgs || bytesArgs.length < 1) throw new Error('Missing args');

const a_type = args[0];
const a_value = args[1];
const id = `w3id=${bytesArgs[0]}`;

return Functions.encodeString(await verifyRequest());

async function verifyRequest() {
  switch (a_type) {
    case 'domain':
      return verifyDomain();
    case 'x':
      return verifyX();
    case 'github':
      return verifyGithub();
    default:
      throw new Error('Bad type');
  }
}

function checkError(resp, isFault) {
  if (resp.error || isFault) throw new Error('Request failed');
}

async function verifyDomain() {
  const hostname = new URL(`https://${a_value}`).hostname;
  if(!hostname.includes('.')) throw new Error();

  const resp = await Functions.makeHttpRequest({
    url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`,
    headers: { 'Accept': 'application/dns-json' }
  });

  checkError(resp, !resp.data || !resp.data.Answer || !Array.isArray(resp.data.Answer) || !resp.data.Answer.some(record => record.data.includes(id)));

  return hostname;
}

async function verifyX() {
  if (!/^\d+$/.test(a_value)) throw new Error('Invalid post ID');

  const resp = await Functions.makeHttpRequest({
    url: `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${a_value}&hide_media=1&hide_thread=1&omit_script=1&dnt=1`
  });

  checkError(resp, !resp.data || !resp.data.author_url || !resp.data.html);

  const textMatch = resp.data.html.match(/<p[^>]*>(.*?)<\/p>/s);

  if (!textMatch || textMatch.length < 2) throw new Error('Invalid html');
  
  const text = textMatch[1]
    .replace(/<(\w+)(\s[^>]*)?>.*?<\/\1>/gs, '')
    .replace(/<[^>]*\/>/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase();
  
  if (!text.includes(id)) throw new Error('Invalid');

  return resp.data.author_url.split('/').pop().toLowerCase();
}

async function verifyGithub() {
  const username = a_value.toLowerCase();

  if(username.length > 39 || !(/^[a-z0-9]([a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/.test(username))) {
    throw new Error('Invalid GitHub username');
  }

  const resp = await Functions.makeHttpRequest({
    url: `https://api.github.com/users/${username}`,
    headers: { 'X-GitHub-Api-Version': '2022-11-28' }
  });

  checkError(resp, !resp.data || !resp.data.login || !resp.data.bio || resp.data.login.toLowerCase() !== username || !resp.data.bio.includes(id));

  return username;
}
