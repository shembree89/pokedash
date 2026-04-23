// Daily probe for Reg M-A trusted-team data sources. Prints a report to
// stdout; "HIT:" lines mean a watcher saw content worth investigating.
// The GitHub Actions workflow greps for HIT: to decide whether to open an
// issue. We always exit 0 — fetch errors are reported as WARN lines.
//
// Rationale (see CLAUDE.md): all current Champions Reg M-A sources publish
// open-teamsheet only. The first trusted source with EVs/nature will almost
// certainly be Smogon's "VGC Reg M-A Sample Teams" thread once it's created.
// This watcher checks for that thread, for pokepast.es links appearing in
// the metagame discussion, and for Champions coverage in the Strategy Dex.

const USER_AGENT =
  "pokedash-watcher/0.1 (+https://github.com/shembree89/pokedash)";

interface ProbeResult {
  name: string;
  url: string;
  hit: boolean;
  // When true, a positive probe is informational only — not a HIT. Used for
  // community-post sources (e.g. mid-thread pokepastes) which we're watching
  // but deliberately not acting on: the user is waiting for curated content.
  informationalOnly?: boolean;
  detail: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

// -- Probes ---------------------------------------------------------------

// Look at the VGC subforum thread list for any M-A thread matching one of
// the canonical curated resource types (Sample Teams, Teams of the Week,
// Viability Rankings, Role Compendium). The Reg I versions of each already
// exist; we're watching for the M-A versions to appear.
async function probeSmogonVgcSubforum(): Promise<ProbeResult> {
  const url =
    "https://www.smogon.com/forums/forums/video-game-championships.513/";
  const name = "Smogon VGC subforum thread list";
  try {
    const html = await fetchText(url);
    // XenForo structure: <div class="structItem-title">...<a ...>Thread Title</a>...</div>
    const blockRe = /<div class="structItem-title">([\s\S]*?)<\/div>/g;
    const titles: string[] = [];
    for (const m of html.matchAll(blockRe)) {
      const linkMatch = m[1].match(/<a[^>]*>([^<]+)<\/a>/);
      if (linkMatch) titles.push(linkMatch[1].trim());
    }
    const rma = titles.filter((t) => /\bm-?a\b/i.test(t));
    const canonical =
      /(sample teams|teams of the week|viability rankings|role compendium|team dumps)/i;
    const curated = rma.filter((t) => canonical.test(t));
    if (curated.length > 0) {
      return {
        name,
        url,
        hit: true,
        detail: `Reg M-A curated threads found: ${curated.join(" | ")}`,
      };
    }
    return {
      name,
      url,
      hit: false,
      detail: `${rma.length} M-A thread(s), none curated-resource flavor. Sample: ${rma.slice(0, 3).join(" | ") || "(none)"}`,
    };
  } catch (e) {
    return { name, url, hit: false, detail: `WARN fetch failed: ${(e as Error).message}` };
  }
}

// Active M-A metagame discussion thread — informational only. Community
// posts here have full EVs but quality varies (users of all levels post
// team ideas). We surface the count in the report so it's visible, but we
// don't fire an issue on this signal — the user is waiting for curated
// sources (Sample Teams etc.), not mid-thread community pastes.
async function probeSmogonRmaDiscussion(): Promise<ProbeResult> {
  const base =
    "https://www.smogon.com/forums/threads/vgc-reg-m-a-metagame-discussion-thread.3780373";
  const name = "Smogon Reg M-A metagame discussion";
  try {
    // Fetch page 1, then discover max page count from its pagination.
    const page1 = await fetchText(`${base}/`);
    const pageNums = [...page1.matchAll(/page-(\d+)/g)].map((m) => parseInt(m[1], 10));
    const maxPage = pageNums.length ? Math.max(...pageNums) : 1;
    const pasteIds = new Set<string>();
    const scan = (html: string) => {
      for (const m of html.matchAll(/pokepast\.es\/([A-Za-z0-9]+)/g)) pasteIds.add(m[1]);
    };
    scan(page1);
    // Scan up to 3 additional pages (most recent). Keep the crawl light.
    const tail = Array.from(
      { length: Math.min(3, Math.max(0, maxPage - 1)) },
      (_, i) => maxPage - i,
    );
    for (const n of tail) {
      try {
        const body = await fetchText(`${base}/page-${n}`);
        scan(body);
      } catch (e) {
        // Silent — one page failure isn't worth failing the probe.
        void e;
      }
    }
    if (pasteIds.size > 0) {
      const sample = [...pasteIds].slice(0, 5).join(", ");
      return {
        name,
        url: base,
        hit: true,
        informationalOnly: true,
        detail: `Found ${pasteIds.size} pokepast.es link(s) (community posts, informational). Sample: ${sample}`,
      };
    }
    return {
      name,
      url: base,
      hit: false,
      informationalOnly: true,
      detail: `No pokepast.es links in pages 1 + ${tail.join(",")}`,
    };
  } catch (e) {
    return { name, url: base, hit: false, informationalOnly: true, detail: `WARN fetch failed: ${(e as Error).message}` };
  }
}

// Smogon Strategy Dex currently stops at SV. Watch for "Champions" appearing
// in the injected game/format dump — that'd mean per-mon EV archetypes are
// incoming.
async function probeSmogonStrategyDex(): Promise<ProbeResult> {
  const url = "https://www.smogon.com/dex/";
  const name = "Smogon Strategy Dex";
  try {
    const html = await fetchText(url);
    const hasChampions = /\bChampions\b/.test(html);
    const hasRegMa = /\b(Reg\s*M-?A|Regulation\s*M-?A)\b/i.test(html);
    if (hasChampions || hasRegMa) {
      return {
        name,
        url,
        hit: true,
        detail: `Dex payload mentions ${hasChampions ? "Champions" : ""}${hasChampions && hasRegMa ? " + " : ""}${hasRegMa ? "Reg M-A" : ""}`,
      };
    }
    return { name, url, hit: false, detail: "No Champions / Reg M-A strings in injected payload" };
  } catch (e) {
    return { name, url, hit: false, detail: `WARN fetch failed: ${(e as Error).message}` };
  }
}

async function main() {
  const stamp = new Date().toISOString();
  const results = await Promise.all([
    probeSmogonVgcSubforum(),
    probeSmogonRmaDiscussion(),
    probeSmogonStrategyDex(),
  ]);
  console.log(`# pokedash source watcher — ${stamp}\n`);
  for (const r of results) {
    const tag = r.informationalOnly ? (r.hit ? "info" : "miss") : r.hit ? "HIT" : "miss";
    console.log(`${tag}: ${r.name}`);
    console.log(`  url: ${r.url}`);
    console.log(`  ${r.detail}\n`);
  }
  const firing = results.filter((r) => r.hit && !r.informationalOnly);
  console.log(`# summary: ${firing.length}/${results.length} HIT(s) that fire an issue`);
}

main().catch((e) => {
  console.error("watcher crashed:", e);
  // Exit 0 anyway — a transient crash shouldn't spam issues.
});
