const axios = require("axios");
async function isOrganization(token, owner, repo) {

    const contributorsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contributors`,
        {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    const contributorCount = contributorsResponse.data.length;

    if (contributorCount >= 3) {
        return true;
    } else {
        return false;
    }
}

module.exports = { isOrganization };