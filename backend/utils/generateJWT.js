const jwt = require('jsonwebtoken');

exports.generateGitHubJWT = (appId, privateKey) => {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        iat: now - 60,           // issued at (60 sec in past for safety)
        exp: now + (10 * 60),    // expires in 10 minutes max
        iss: appId               // GitHub App ID
    };

    const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256"
    });

    return token;
}
