/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const msal = require('@azure/msal-node');
const identity = require("@azure/identity");
const keyvault = require("@azure/keyvault-certificates");

const keyVaultName = process.env["KEY_VAULT_NAME"];
const KVUri = "https://" + keyVaultName + ".vault.azure.net";

const credential = new identity.DefaultAzureCredential();
const client = new keyvault.CertificateClient(KVUri, credential);

client.getCertificate("NodeWebCert").then((response) => {
    let thumbprint = response.properties.x509Thumbprint.toString('hex').toUpperCase();
    console.log(thumbprint);
});

const privateKeySource = fs.readFileSync('./certificates/NodeWebCert/NodeWebCert.pem')

const privateKeyObject = crypto.createPrivateKey({
    key: privateKeySource,
    passphrase: "225588",
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
            thumbprint: "239B5C4E60A8F2CF5C862A8D62CC11DFA5E6DCD7",
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
        redirectUri: "http://localhost:3000/redirect",
    };

    // get url to sign user in and consent to scopes needed for application
    cca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
        res.redirect(response);
    }).catch((error) => console.log(JSON.stringify(error)));
});

app.get('/redirect', (req, res) => {
    const tokenRequest = {
        code: req.query.code,
        scopes: ["user.read"],
        redirectUri: "http://localhost:3000/redirect",
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

app.listen(SERVER_PORT, () => console.log(`Msal Node Auth Code Sample app listening on port ${SERVER_PORT}!`))