
const DUNGEONS = ["Operation: Floodgate", "Cinderbrew Meadery", "The Rookery", "Priory of the Sacred Flame"];

let runs = [], roster = [];

Promise.all([
  fetch("runs.json").then(r => r.json()),
  fetch("roster.json").then(r => r.json())
]).then(([runsData, rosterData]) => {
  runs = runsData;
  roster = rosterData;
});

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

  const characterRuns = roster
    .filter(entry => entry.character.toLowerCase() === characterKey.toLowerCase())
    .map(entry => entry.run_id);

  const filteredRuns = runs.filter(run => characterRuns.includes(run.run_id));

  const report = DUNGEONS.map(dungeon => {
    const dungeonRuns = filteredRuns
      .filter(run => run.dungeon_name === dungeon)
      .sort((a, b) => b.difficulty_level - a.difficulty_level);

    if (dungeonRuns.length === 0) return { dungeon, message: "No runs found." };

    const maxLevel = dungeonRuns[0].difficulty_level;
    const topRuns = dungeonRuns.filter(run => run.difficulty_level === maxLevel);

    topRuns.sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
    return {
      dungeon,
      level: maxLevel,
      firstCleared: topRuns[0].completed_at,
      count: topRuns.length,
      run_id: topRuns[0].run_id
    };
  });

  report.forEach(entry => {
    if (entry.message) {
      resultDiv.innerHTML += `<p><strong>${entry.dungeon}:</strong> ${entry.message}</p>`;
    } else {
      resultDiv.innerHTML += `<p>
        <strong>${entry.dungeon}</strong>: +${entry.level}<br>
        First Cleared: ${entry.firstCleared}<br>
        Times Cleared: ${entry.count}<br>
        Run ID: ${entry.run_id}
      </p>`;
    }
  });
}
