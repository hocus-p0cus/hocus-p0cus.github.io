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

let stats = [];

fetch("tww-season2-eu-character_dungeon_stats.json")
  .then(res => res.json())
  .then(data => {
    stats = data;
  });

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
      return {
        level,
        count: best.completion_count,
        run_id: best.first_run_id
      };
    });

    return {
      dungeon,
      runs: bestRuns
    };
  });

  report.forEach(entry => {
    resultDiv.innerHTML += `<p class="dungeon-name">${entry.dungeon}</p>`;
    
    if (entry.runs.length === 0) {
      resultDiv.innerHTML += `<p class="dungeon-runs">&nbsp;&nbsp;&nbsp;No runs found.</p>`;
      return;
    }

    let runsContent = '';
    entry.runs.forEach((run, i) => {
      const runLink = `https://raider.io/mythic-plus-runs/season-tww-2/${run.run_id}`;
      const paddedCount = run.count < 10 ? `&nbsp;${run.count}` : run.count;
      runsContent += `&nbsp;&nbsp;&nbsp;🗝️ +${run.level} | 🔁 Completions: ${paddedCount} | 🔗 <a href="${runLink}" target="_blank" rel="noopener noreferrer">Run ID: ${run.run_id}</a>`;
      
      if (i < entry.runs.length - 1) {
        runsContent += `<br>`;
      }
    });

    resultDiv.innerHTML += `<p class="dungeon-runs">${runsContent}</p>`;
  });
}