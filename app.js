const dataByRegion = {};

let DUNGEONS = [];

let slugMapping = null;
let currentMode = "link";
let currentSeason = "mn-season2";
let isGenerating = false;

const CONFIG = {
  seasons: [
    { id: 'tww-season2', label: 'TWW Season 2' },
    { id: 'tww-season3', label: 'TWW Season 3'},
    { id: 'mn-season1', label: 'MN Season 1'},
    { id: 'mn-season2', label: 'MN Season 2', default: true }
  ],
  regions: ['eu', 'na'],
  dataPath: 'data'
};

function slugify(name) {
  let slugged = name;
  slugged = slugged.replace(/[!@#$%^&\*\(\)~`_\+=\[\]\{\};:"\.\,<>\/?'-]/g, '');
  slugged = slugged.replace(/\s+/g, '-');
  slugged = slugged.toLowerCase();
  return slugged;
}

function getSeasonDataPath(season, filename) {
  return `${CONFIG.dataPath}/${season}/${filename}`;
}

function getRegionDataPath(season, region, type) {
  // type: 'character_dungeon_stats' or 'roster'
  const filename = `${season}-${region}-${type}.json`;
  return `${CONFIG.dataPath}/${season}/${region}/${filename}`;
}

async function loadDungeons() {
  const dungeonPath = getSeasonDataPath(currentSeason, 'dungeons.json');
  DUNGEONS = await fetch(dungeonPath).then(res => res.json());
  return { DUNGEONS };
}

async function loadSlugMapping() {
  if (slugMapping) return Promise.resolve(slugMapping);
  return fetch(`${CONFIG.dataPath}/slug_mapping.json`)
    .then(res => res.json())
    .then(data => {
      slugMapping = data;
      return slugMapping;
    });
}

async function populateRealmSuggestions() {
  const mapping = await loadSlugMapping();
  const datalist = document.getElementById("realm-suggestions");
  
  datalist.innerHTML = "";

  const realmNames = Object.values(mapping).sort((a, b) => a.localeCompare(b));

  for (const realm of realmNames) {
    const option = document.createElement("option");
    option.value = realm;
    datalist.appendChild(option);
  }
}

// Preprocess raw data into efficient lookup structures
function preprocessData(stats, roster) {
  // Character stats: Map<character_id, Map<dungeon_name, Array<entry>>>
  const characterStats = new Map();
  
  for (const entry of stats) {
    const charId = entry.character_id.toLowerCase();
    
    if (!characterStats.has(charId)) {
      characterStats.set(charId, new Map());
    }
    
    const dungeonMap = characterStats.get(charId);
    if (!dungeonMap.has(entry.dungeon_name)) {
      dungeonMap.set(entry.dungeon_name, []);
    }
    
    dungeonMap.get(entry.dungeon_name).push(entry);
  }
  
  // Roster lookup: Map<run_id, Set<character_id>>
  const rosterByRunId = new Map();
  
  for (const rosterEntry of roster) {
    rosterByRunId.set(
      rosterEntry.run_id,
      new Set(rosterEntry.character_ids.map(id => id.toLowerCase()))
    );
  }
  
  return { characterStats, rosterByRunId };
}

async function fetchJson(basePath) {
  try {
    const gzResponse = await fetch(`${basePath}.gz`);
    if (gzResponse.ok) {
      const stream = gzResponse.body.pipeThrough(new DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
  } catch (err) {
    console.warn(`Failed to fetch ${basePath}.gz, falling back to plain JSON:`, err);
  }
  
  const response = await fetch(basePath);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${basePath}: ${response.status}`);
  }
  return response.json();
}

function loadRegionData(region) {
  const key = `${currentSeason}-${region}`;
  if (dataByRegion[key]) {
    return Promise.resolve(dataByRegion[key]);
  }

  return Promise.all([
    fetchJson(getRegionDataPath(currentSeason, region, 'character_dungeon_stats')),
    fetchJson(getRegionDataPath(currentSeason, region, 'roster'))
  ]).then(([stats, roster]) => {
    const processed = preprocessData(stats, roster);
    dataByRegion[key] = {
      stats,
      roster,
      characterStats: processed.characterStats,
      rosterByRunId: processed.rosterByRunId
    };
    return dataByRegion[key];
  });
}

async function setSeason(season) {
  currentSeason = season;
  await loadDungeons();

  // Update active state on all season buttons
  document.querySelectorAll(".season-button").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.season === season) {
      btn.classList.add("active");
    }
  });

  generateReport();
}

function resilientKeyLevel(characterStats, characterId, timestamp) {
  const charId = characterId.toLowerCase();
  const dungeonMap = characterStats.get(charId);
  
  if (!dungeonMap) return 0;
  
  const levels = [];
  
  for (const dungeon of DUNGEONS) {
    const entries = dungeonMap.get(dungeon);
    
    if (!entries) return 0;
    
    let best = 0;
    for (const entry of entries) {
      if (entry.first_completed < timestamp) {
        best = Math.max(best, entry.difficulty_level);
      }
    }
    
    if (best === 0) return 0;
    levels.push(best);
  }
  
  return levels.length ? Math.min(...levels) : 0;
}

function switchInputMode(mode) {
  if (mode === currentMode) return;

  currentMode = mode;

  const manual = document.getElementById("manual-inputs");
  const link = document.getElementById("link-inputs");
  const indicator = document.getElementById("mode-indicator");
  const buttons = document.querySelectorAll(".toggle-button");

  if (mode === "manual") {
    manual.classList.add("active");
    link.classList.remove("active");
    indicator.textContent = "💡 Press paste if you have already copied a profile link.";
  } else {
    manual.classList.remove("active");
    link.classList.add("active");
    indicator.textContent = "💡 Paste a profile link from Raider.IO site or WoW addon.";
  }

  buttons.forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.toggle-button[onclick*="${mode}"]`).classList.add("active");
}

function toRaiderIoSlug(seasonKey) {
  const match = seasonKey.match(/^(\w+)-season(\d+)$/);
  if (!match) return seasonKey;
  const [_, expac, num] = match;
  return `season-${expac}-${num}`;
}

async function generateReport() {
  if (isGenerating) return;
  isGenerating = true;

  const mode = currentMode;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  let name, realm, region;

  if (mode === "manual") {
    name = document.getElementById("name").value.trim().toLowerCase();
    realm = document.getElementById("realm").value.trim();
    region = document.getElementById("region").value;

    if (!name || !realm) {
      resultDiv.innerHTML = "<p>Enter both character and realm name.</p>";
      isGenerating = false;
      return;
    }
  } else {
    const link = document.getElementById("profile-link").value.trim();
    const match = link.match(/^(?:https?:\/\/)?raider\.io\/characters\/(eu|us)\/([^\/]+)\/([^\/?#]+)/i);

    if (!match) {
      resultDiv.innerHTML = "<p>Invalid Raider.IO profile link.</p>";
      isGenerating = false;
      return;
    }

    region = match[1].toLowerCase() === "us" ? "na" : match[1].toLowerCase();
    const slug = decodeURIComponent(match[2].toLowerCase());
    name = decodeURIComponent(match[3].toLowerCase());

    const mapping = await loadSlugMapping();
    realm = mapping[slug];

    if (!realm) {
      resultDiv.innerHTML = `<p>Unknown realm slug: ${slug}</p>`;
      isGenerating = false;
      return;
    }
  }

  const characterKey = `${name}-${realm}`;

  if (!name || !realm) {
    resultDiv.innerHTML = "<p>Enter both character and realm name.</p>";
    isGenerating = false;
    return;
  }

  try {
    const { characterStats, rosterByRunId } = await loadRegionData(region);
    
    const charId = characterKey.toLowerCase();
    const dungeonMap = characterStats.get(charId);
    
    if (!dungeonMap) {
      resultDiv.innerHTML = "<p>No data found for this character.</p>";
      return;
    }

    const report = DUNGEONS.map(dungeon => {
      const entries = dungeonMap.get(dungeon);

      if (!entries || entries.length === 0) {
        return {
          dungeon,
          runs: []
        };
      }

      // Group by difficulty level
      const grouped = new Map();
      for (const entry of entries) {
        if (!grouped.has(entry.difficulty_level)) {
          grouped.set(entry.difficulty_level, []);
        }
        grouped.get(entry.difficulty_level).push(entry);
      }

      // Get top 2 levels
      const sortedLevels = Array.from(grouped.keys()).sort((a, b) => b - a);
      const topTwo = sortedLevels.slice(0, 2);

      const bestRuns = topTwo.map(level => {
        const runsAtLevel = grouped.get(level);
        runsAtLevel.sort((a, b) => new Date(a.first_completed) - new Date(b.first_completed));
        const best = runsAtLevel[0];

        const rosterChars = rosterByRunId.get(best.first_run_id);
        
        let countResilient = 0;
        if (rosterChars) {
          for (const rosterId of rosterChars) {
            if (rosterId !== charId) {
              const resilientLevel = resilientKeyLevel(characterStats, rosterId, best.first_completed);
              if (resilientLevel >= level) {
                countResilient++;
              }
            }
          }
        }

        return {
          level,
          count: best.completion_count,
          run_id: best.first_run_id,
          resilient: countResilient
        };
      });

      return {
        dungeon,
        runs: bestRuns
      };
    });

    report.forEach(entry => {
      const dungeonIcon = `icons/${slugify(entry.dungeon)}.png`;
      
      let runsContent = '';
      if (entry.runs.length === 0) {
        runsContent = '<div class="dungeon-runs">No runs found.</div>';
      } else {
        entry.runs.forEach((run, i) => {
          const runLink = `https://raider.io/mythic-plus-runs/${toRaiderIoSlug(currentSeason)}/${run.run_id}`;
          const paddedCount = run.count < 10 ? `&nbsp;&nbsp;${run.count}` : run.count;
          const symbol = run.resilient === 0 ? "✅" : "❓";

          runsContent += `🗝️ +${run.level} | 🔁 Completions: ${paddedCount} | Characters in the group with Resilient Key ≥ +${run.level}: ${run.resilient}${symbol} |🔗 <a href="${runLink}" target="_blank" rel="noopener noreferrer">Link</a>`;
          
          if (i < entry.runs.length - 1) {
            runsContent += `<br>`;
          }
        });
        runsContent = `<div class="dungeon-runs">${runsContent}</div>`;
      }
      
      resultDiv.innerHTML += `
        <div class="dungeon-block">
          <img src="${dungeonIcon}" alt="${entry.dungeon}" class="dungeon-icon">
          <div class="dungeon-content">
            <div class="dungeon-name">${entry.dungeon}</div>
            ${runsContent}
          </div>
        </div>
      `;
    });
  } finally {
    isGenerating = false;
  }
}

// Initialize season buttons dynamically from config
function initializeSeasonButtons() {
  const seasonToggle = document.querySelector('.season-toggle');
  if (!seasonToggle) return;

  seasonToggle.innerHTML = '';
  
  CONFIG.seasons.forEach(season => {
    const button = document.createElement('button');
    button.className = 'season-button' + (season.default ? ' active' : '');
    button.textContent = season.label;
    button.dataset.season = season.id; // Add data attribute for easy lookup
    button.onclick = () => setSeason(season.id);
    seasonToggle.appendChild(button);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initializeSeasonButtons();
  
  await loadDungeons();
  populateRealmSuggestions();

  const params = new URLSearchParams(window.location.search);
  const nameParam = params.get("character");
  const realmParam = params.get("realm");
  const regionParam = params.get("region");
  const seasonParam = params.get("season");

  if (seasonParam) {
    await setSeason(seasonParam);
  }

  if (regionParam) {
    const regionSelect = document.getElementById("region");
    if (regionSelect) regionSelect.value = regionParam.toLowerCase();
  }

  if (nameParam && realmParam) {
    switchInputMode("manual");
    document.getElementById("name").value = nameParam;
    document.getElementById("realm").value = realmParam;

    await new Promise(r => setTimeout(r, 200));
    await generateReport();
  }

  document.addEventListener("paste", async (event) => {
    const activeElement = document.activeElement;

    if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA") {
      return;
    }

    const clipboardData = event.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData("text");

    const match = pastedText.match(/^(?:https?:\/\/)?raider\.io\/characters\/(eu|us)\/([^\/]+)\/([^\/?#]+)/i);
    if (!match) return;

    const linkInput = document.getElementById("profile-link");

    switchInputMode("link");

    linkInput.value = pastedText;
    await generateReport();
  });
});