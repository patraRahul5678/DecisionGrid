function extractTeamsFromInsights(text, teams) {

  for (const team of teams) {
    if (text.toLowerCase().includes(team.toLowerCase())) {
      return team;
    }
  }

  return null;
}

function extractDevsFromInsights(text, devs) {

  for (const dev of devs) {
    if (text.toLowerCase().includes(dev.toLowerCase())) {
      return [dev];
    }
  }

  return null;  
}

module.exports = { extractTeamsFromInsights, extractDevsFromInsights };