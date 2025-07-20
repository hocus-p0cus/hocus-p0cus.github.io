const DUNGEONS = [
  "Priory of the Sacred Flame",
  "The Rookery",
  "Cinderbrew Meadery",
  "Operation: Floodgate",
  "Mechagon Workshop",
  "Theater of Pain",
  "The MOTHERLODE!!",
  "Darkflame Cleft"
];

const DUNGEON_ICONS = {
  "Darkflame Cleft": "icons/darkflame-cleft.png",
  "The MOTHERLODE!!": "icons/motherlode.png",
  "Theater of Pain": "icons/theater-of-pain.png",
  "Operation: Floodgate": "icons/operation-floodgate.png",
  "Cinderbrew Meadery": "icons/cinderbrew-meadery.png",
  "The Rookery": "icons/rookery.png",
  "Mechagon Workshop": "icons/mechagon-workshop.png",
  "Priory of the Sacred Flame": "icons/priory-sacred-flame.png"
};

const dataByRegion = {};

let slugMapping = null;
let currentMode = "link";

async function loadSlugMapping() {
  if (slugMapping) return Promise.resolve(slugMapping);
  return fetch("slug_mapping.json")
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

function loadRegionData(region) {
  if (dataByRegion[region]) {
    return Promise.resolve(dataByRegion[region]);
  }

  return Promise.all([
    fetch(`tww-season2-${region}-character_dungeon_stats.json`).then(res => res.json()),
    fetch(`tww-season2-${region}-roster.json`).then(res => res.json())
  ]).then(([stats, roster]) => {
    dataByRegion[region] = { stats, roster };
    return dataByRegion[region];
  });
}

function resilientKeyLevel(stats, characterId, timestamp) {
  const levels = [];

  for (const dungeon of DUNGEONS) {
    const entries = stats.filter(
      e => e.character_id === characterId &&
           e.dungeon_name === dungeon &&
           e.first_completed < timestamp
    );

    const best = entries.reduce((max, e) => Math.max(max, e.difficulty_level), 0);
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

async function generateReport() {

  const mode = currentMode;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  let name, realm, region;

  if (mode === "manual") {

    name = document.getElementById("name").value.trim().toLocaleLowerCase();
    realm = document.getElementById("realm").value.trim();
    region = document.getElementById("region").value;

    if (!name || !realm) {
      resultDiv.innerHTML = "<p>Enter both character and realm name.</p>";
      return;
    }

  } else {
    const link = document.getElementById("profile-link").value.trim();
    const match = link.match(/^(?:https?:\/\/)?raider\.io\/characters\/(eu|us)\/([^\/]+)\/([^\/?#]+)/i);

    if (!match) {
      resultDiv.innerHTML = "<p>Invalid Raider.IO profile link.</p>";
      return;
    }

    region = match[1].toLowerCase() === "us" ? "na" : match[1].toLowerCase();
    const slug = decodeURIComponent(match[2].toLocaleLowerCase());
    name = decodeURIComponent(match[3].toLowerCase());

    const mapping = await loadSlugMapping();
    realm = mapping[slug];

    if (!realm) {
      resultDiv.innerHTML = `<p>Unknown realm slug: ${slug}</p>`;
      return;
    }
  }

  const characterKey = `${name}-${realm}`;

  if (!name || !realm) {
    resultDiv.innerHTML = "<p>Enter both character and realm name.</p>";
    return;
  }

  loadRegionData(region).then(({ stats, roster }) => {
    const charStats = stats.filter(
      entry => entry.character_id.toLocaleLowerCase() === characterKey.toLocaleLowerCase()
    );

    const report = DUNGEONS.map(dungeon => {
      const entries = charStats.filter(entry => entry.dungeon_name === dungeon);

      if (entries.length === 0) {
        return {
          dungeon,
          runs: []
        };
      }

      const grouped = {};
      for (const entry of entries) {
        if (!grouped[entry.difficulty_level]) {
          grouped[entry.difficulty_level] = [];
        }
        grouped[entry.difficulty_level].push(entry);
      }

      const sortedLevels = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => b - a);

      const topTwo = sortedLevels.slice(0, 2);

      const bestRuns = topTwo.map(level => {
        const runsAtLevel = grouped[level];
        runsAtLevel.sort((a, b) => new Date(a.first_completed) - new Date(b.first_completed));
        const best = runsAtLevel[0];

        const rosterEntries = roster.filter(r => r.run_id === best.first_run_id);
        const rosterChars = rosterEntries.length > 0 ? rosterEntries[0].character_ids : [];

        const countResilient = rosterChars.filter(id =>
          id.toLocaleLowerCase() !== characterKey.toLocaleLowerCase() &&
          resilientKeyLevel(stats, id, best.first_completed) >= level
        ).length;

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
      const dungeonIcon = DUNGEON_ICONS[entry.dungeon] || "icons/default-dungeon.png";
      
      let runsContent = '';
      if (entry.runs.length === 0) {
        runsContent = '<div class="dungeon-runs">No runs found.</div>';
      } else {
        entry.runs.forEach((run, i) => {
          const runLink = `https://raider.io/mythic-plus-runs/season-tww-2/${run.run_id}`;
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
  });
}

document.addEventListener("DOMContentLoaded", () => {

  populateRealmSuggestions();

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