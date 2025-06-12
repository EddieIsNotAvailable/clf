if (!args || args.length < 2) {
  throw new Error("Missing args")
}

const a_type = args[0]
const a_value = args[1]

if (!bytesArgs || bytesArgs.length < 1) {
  throw new Error("Missing bytesArgs")
}

// Verified msg.sender address
// Will be a lowercase hex string of the bytes
const a_address = bytesArgs[0]

return Functions.encodeString(await verifyRequest())

// ---Function Definitions---

async function verifyRequest() {
  switch (a_type) {
    case "domain":
      return verifyDomain()
    case "x":
      return verifyX()
    case "github":
      return verifyGithub()
    default:
      throw new Error("Bad type")
  }
}

function makeId() {
  return "w3id=" + a_address
}

function verifyIDInString(text) {
  if (!text.includes(makeId())) throw new Error("Invalid")
}

function checkErrorAndThrow(resp) {
  if (resp.error || !resp.data || resp.status !== 200) {
    throw new Error("Request failed")
  }
}

function validateResponse(isFault) {
  if (isFault) {
    throw new Error("Malformed response")
  }
}

async function verifyDomain() {
  const hostname = new URL(`https://${a_value}`).hostname; // Will throw error if invalid url
  if(!hostname.includes(".")) throw new Error() // Prevent hostname lacking tld

  const dohProvider = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`

  const resp = await Functions.makeHttpRequest({
    url: dohProvider,
    headers: {
      'Accept': 'application/dns-json'
    }
  })

  checkErrorAndThrow(resp)
  
  const data = resp.data
  validateResponse(!data.Answer || !Array.isArray(data.Answer))

  const id = makeId()

  if (data.Answer.some(record => record.data.includes(id))) {
    return hostname
  }

  throw new Error("Invalid")
}


async function verifyX() {
  const postId = a_value

  if (!/^\d+$/.test(postId)) { // Must be numbers only
    throw new Error("Invalid X post ID")
  }

  const resp = await Functions.makeHttpRequest({
    url: `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${postId}&hide_media=1&hide_thread=1&omit_script=1&dnt=1`
  })

  checkErrorAndThrow(resp, "Twitter oEmbed")

  const data = resp.data
  validateResponse(!data.author_url || !data.html)

  // Extract tweet message, should be in the p element
  const textMatch = data.html.match(/<p[^>]*>(.*?)<\/p>/s)
  
  const text = textMatch[1]
    .replace(/<(\w+)(\s[^>]*)?>.*?<\/\1>/gs, '') // Remove child HTML elements and their content
    .replace(/<[^>]*\/>/g, '') // Remove self-closing tags
    .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
    .trim()
    .toLowerCase()
  
  verifyIDInString(text)

  const handle = data.author_url.split("/").pop().toLowerCase()

  return handle
}

async function verifyGithub() {
  const username = a_value.toLowerCase()

  if(!(/^[a-z0-9]([a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/.test(username) && username.length <= 39)) {
    throw new Error("Invalid GitHub username")
  }

  const resp = await Functions.makeHttpRequest({
    url: `https://api.github.com/users/${username}`,
    headers: { 
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  checkErrorAndThrow(resp, "GitHub API")

  const data = resp.data

  validateResponse(!data.login || !data.bio)

  // Login is case insensitive
  if (data.login.toLowerCase() !== username) {
    throw new Error("GitHub username mismatch")
  }

  verifyIDInString(data.bio)

  return username
}