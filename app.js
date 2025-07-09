const DUNGEONS = [
  "Darkflame Cleft",
  "The MOTHERLODE!!",
  "Theater of Pain",
  "Operation: Floodgate",
  "Cinderbrew Meadery",
  "The Rookery",
  "Mechagon Workshop",
  "Priory of the Sacred Flame"
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

let stats = [];
let roster = [];

/* fetch("tww-season2-eu-character_dungeon_stats.json")
  .then(res => res.json())
  .then(data => {
    stats = data;
  });
*/ 

Promise.all([
  fetch("tww-season2-eu-character_dungeon_stats.json").then(res => res.json()),
  fetch("tww-season2-eu-roster.json").then(res => res.json())
]).then(([statsData, rosterData]) => {
  stats = statsData;
  roster = rosterData;
});

function resilientKeyLevel(characterId, timestamp) {
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

function generateReport() {
  const name = document.getElementById("name").value.trim();
  const realm = document.getElementById("realm").value.trim();
  const characterKey = `${name}-${realm}`;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  if (!name || !realm) {
    resultDiv.innerHTML = "<p>Enter both character and realm name.</p>";
    return;
  }

  const charStats = stats.filter(
    entry => entry.character_id.toLowerCase() === characterKey.toLowerCase()
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
      const rosterChars = rosterEntries.map(r => r.character_id);
      const countResilient = rosterChars.filter(id =>
        resilientKeyLevel(id, best.first_completed) >= level
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

        runsContent += `🗝️ +${run.level} | 🔁 Completions: ${paddedCount} | Characters with Resilient Key ≥ +${run.level}: ${run.resilient}${symbol} |🔗 <a href="${runLink}" target="_blank" rel="noopener noreferrer">Link</a>`;
        
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
}