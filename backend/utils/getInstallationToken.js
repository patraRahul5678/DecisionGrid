const axios = require("axios");

async function getInstallationToken(jwtToken, installationId) {
    const response = await axios.post(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {},
        {
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    return response.data.token;
}

module.exports = { getInstallationToken };