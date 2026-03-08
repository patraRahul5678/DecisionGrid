const axios = require("axios");

async function getTeams(token, org) {

  const res = await axios.get(
    `https://api.github.com/orgs/${org}/teams`,
    {
      headers: { Authorization: `token ${token}` }
    }
  );

  return res.data.map(t => t.slug);
}

module.exports = { getTeams };