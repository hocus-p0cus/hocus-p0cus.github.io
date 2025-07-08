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
        message: "No runs found."
      };
    }

    const maxLevel = Math.max(...entries.map(e => e.difficulty_level));
    const maxEntries = entries.filter(e => e.difficulty_level === maxLevel);

    maxEntries.sort((a, b) => new Date(a.first_completed) - new Date(b.first_completed));
    const best = maxEntries[0];

    return {
      dungeon,
      level: best.difficulty_level,
      firstCleared: best.first_completed,
      count: best.completion_count,
      run_id: best.first_run_id
    };
  });

  report.forEach(entry => {
  if (entry.message) {
    resultDiv.innerHTML += `<p><strong>${entry.dungeon}:</strong> ${entry.message}</p>`;
  } else {
    const runLink = `https://raider.io/mythic-plus-runs/season-tww-2/${entry.run_id}`;

    resultDiv.innerHTML += `<p>
      <strong>${entry.dungeon}</strong>: +${entry.level}<br>
      Completions: ${entry.count}<br>
      Run ID: <a href="${runLink}" target="_blank" rel="noopener noreferrer">${entry.run_id}</a>
    </p>`;
  }
});
}