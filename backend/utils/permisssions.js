const axios = require("axios");

async function allowed(token, owner, repo) {

    const collaborators = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/collaborators`,
        {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    let allowedDevelopers = {};

    collaborators.data.forEach(user => {

        if (
            user.permissions?.push ||
            user.permissions?.admin ||
            user.permissions?.maintain
        ) {
            allowedDevelopers[user.login] = true;
        }

    });

    return allowedDevelopers;
}

module.exports = { allowed };