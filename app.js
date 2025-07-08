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

let stats = [], runsById = {};

Promise.all([
  fetch("character_dungeon_stats.json").then(r => r.json()),
  fetch("runs.json").then(r => r.json())
]).then(([statsData, runsData]) => {
  stats = statsData;
  runsById = Object.fromEntries(runsData.map(run => [run.run_id, run]));
});

function makeLink(run_id) {
  return `<a href="https://raider.io/mythic-plus-runs/season-tww-2/${run_id}" target="_blank">🔗 Run ${run_id}</a>`;
}

function formatLine(entry) {
  const emoji = entry.completion_count === 1 ? "👶" : "💪";
  const link = makeLink(entry.first_run_id);
  return `🗝️ +${entry.difficulty_level} | ${emoji} ${entry.completion_count} | ${link}`;
}

function generateReport() {
  const name = document.getElementById("name").value.trim();
  const realm = document.getElementById("realm").value.trim();
  const characterKey = `${name}-${realm}`;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  if (!name || !realm) {
    resultDiv.innerHTML = "<p>Enter character and realm name.</p>";
    return;
  }

  resultDiv.innerHTML += `<h3>📜 Report for ${characterKey}</h3>`;

  for (const dungeon of DUNGEONS) {
    const dungeonStats = stats
      .filter(entry =>
        entry.character_id.toLowerCase() === characterKey.toLowerCase() &&
        entry.dungeon_name === dungeon
      )
      .sort((a, b) => b.difficulty_level - a.difficulty_level);

    if (dungeonStats.length === 0) {
      resultDiv.innerHTML += `<p>🔸 <strong>${dungeon}</strong>: No runs found.</p>`;
      continue;
    }

    const top = dungeonStats[0];
    const second = dungeonStats.find(
      e => e.difficulty_level === top.difficulty_level - 1
    );

    resultDiv.innerHTML += `<p>🔹 <strong>${dungeon}</strong>:<br>
      ${formatLine(top)}<br>
      ${second ? formatLine(second) : `🗝️ +${top.difficulty_level - 1} | No data`}
    </p>`;
  }
}
