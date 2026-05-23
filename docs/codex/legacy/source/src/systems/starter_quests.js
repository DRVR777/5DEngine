export function mountStarterQuests({ addQuest, showToast, loadGame }) {
  setTimeout(() => {
    addQuest("intro", "Explorer", [
      "Collect your first coin",
      "Collect 3 coins",
      "Collect all coins",
    ]);
    addQuest("combat", "Fighter", [
      "Defeat your first enemy",
      "Defeat 3 enemies",
    ]);
    addQuest("world", "World Builder", [
      "Enter build mode (B)",
      "Place a spawn point (N in build mode)",
    ]);
    showToast("Press J to view objectives", "info", 4000);
    setTimeout(loadGame, 200);
  }, 1500);
}
