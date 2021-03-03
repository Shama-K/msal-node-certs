/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

const express = require('express');

const pem = require('pem');
const msal = require('@azure/msal-node');
const identity = require("@azure/identity");
const keyvaultCert = require("@azure/keyvault-certificates");
const keyvaultSecret = require('@azure/keyvault-secrets');

const SERVER_PORT = process.env.PORT || 3000;

const KVUri = "https://derisen-test-vault.vault.azure.net";

const credential = new identity.DefaultAzureCredential();

const certClient = new keyvaultCert.CertificateClient(KVUri, credential);
const secretClient = new keyvaultSecret.SecretClient(KVUri, credential);

async function main() {

    const certResponse = await certClient.getCertificate("ExampleCert1");
    const thumbprint = certResponse.properties.x509Thumbprint.toString('hex').toUpperCase();
    
    const secretResponse = await secretClient.getSecret("ExampleCert1");

    pem.readPkcs12(Buffer.from(secretResponse.value, 'base64'), (err, cert) => {

        // Before running the sample, you will need to replace the values in the config
        const config = {
            auth: {
                clientId: "6931864c-9eec-43ca-9351-06c3579e662a",
                authority: "https://login.microsoftonline.com/cbaf2168-de14-4c72-9d88-f5f05366dbef",
                clientCertificate: {
                    thumbprint: thumbprint,
                    privateKey: cert.key,
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
                redirectUri: "https://node-cert-test.azurewebsites.net/redirect",
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
                redirectUri: "https://node-cert-test.azurewebsites.net/redirect",
            };

            cca.acquireTokenByCode(tokenRequest).then((response) => {
                console.log("\nResponse: \n:", response);
                res.status(200).send('Congratulations! You have signed in successfully');
            }).catch((error) => {
                console.log(error);
                res.status(500).send(error);
            });
        });

        app.listen(SERVER_PORT, () => {
            console.log(`Msal Node Auth Code Sample app listening on port ${SERVER_PORT}!`)
        });
    });
}

main();