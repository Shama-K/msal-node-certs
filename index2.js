/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const express = require('express');

const msal = require('@azure/msal-node');

// Importing local files
const privateKeySource = fs.readFileSync('./certificates/example.com/example.key');

const privateKeyObject = crypto.createPrivateKey({
    key: privateKeySource,
    passphrase: "2255",
    format: 'pem'
});

const privateKey = privateKeyObject.export({
    format: 'pem',
    type: 'pkcs8'
});

// Before running the sample, you will need to replace the values in the config
const config = {
    auth: {
        clientId: "6931864c-9eec-43ca-9351-06c3579e662a",
        authority: "https://login.microsoftonline.com/cbaf2168-de14-4c72-9d88-f5f05366dbef",
        clientCertificate: {
            thumbprint: "9ED380D31CEDEEE8464AEE79E64DA96CE58132F8",
            privateKey: privateKey,
        }
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Verbose,
        }
    }
};

// Create msal application object
const cca = new msal.ConfidentialClientApplication(config);

// Create Express App and Routes
const app = express();

app.get('/', (req, res) => {
    const authCodeUrlParameters = {
        scopes: ["user.read"],
        redirectUri: "https://localhost:3000/redirect",
    };

    // get url to sign user in and consent to scopes needed for application
    cca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
        console.log(response);
        res.redirect(response);
    }).catch((error) => console.log(JSON.stringify(error)));
});

app.get('/redirect', (req, res) => {
    const tokenRequest = {
        code: req.query.code,
        scopes: ["user.read"],
        redirectUri: "https://localhost:3000/redirect",
    };

    cca.acquireTokenByCode(tokenRequest).then((response) => {
        console.log("\nResponse: \n:", response);
        res.status(200).send('Congratulations! You have signed in successfully');
    }).catch((error) => {
        console.log(error);
        res.status(500).send(error);
    });
});

const SERVER_PORT = process.env.PORT || 3000;

const options = {
    key: fs.readFileSync(path.join(__dirname + "/certificates/example.com/example.key")),
    cert: fs.readFileSync(path.join(__dirname + "/certificates/example.com/example.crt")),
    passphrase: "2255"
};

const server = https.createServer(options, app);

server.listen(SERVER_PORT, () => {
    console.log(`Msal Node Auth Code Sample app listening on port ${SERVER_PORT}!`)
});