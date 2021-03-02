# Securing MSAL Node Client Credentials with Azure

A **client credential** is mandatory for confidential clients. Client credential can be a:

* `clientSecret` is secret string generated set on the app registration.
* `clientCertificate` is a certificate set on the app registration. The `thumbprint` is a *X.509 SHA-1* thumbprint of the certificate, and the `privateKey` is the PEM encoded private key. `x5c` is the optional *X.509* certificate chain used in [subject name/issuer auth scenarios](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/sni.md).
* `clientAssertion` is string that the application uses when requesting a token. The certificate used to sign the assertion should be set on the app registration. Assertion should be of type `urn:ietf:params:oauth:client-assertion-type:jwt-bearer`.

The following application types are considered confidential clients in **MSAL Node**:

* Web apps
* Console apps
* Daemon apps

## Using Certificates

### Generating self-signed certificates

Build and install **OpenSSL** for your **OS** following the guide at [github.com/openssl](https://github.com/openssl/openssl#build-and-install). If you like to skip building and get a binary distributable instead, check the [OpenSSL Wiki: Binaries](https://wiki.openssl.org/index.php/Binaries) page.

Afterwards, add the path to `OpenSSL` to your **environment variables** so that you can call it from anywhere.

Type the following in a terminal:

```console
    OpenSSL> req -new -sha256 -nodes -out example.com.csr -newkey rsa:2048 -keyout example.com.key 
```

You will be prompted to enter some identifying information, and a **challenge password** (*i.e.* *passphrase*), which will be asked in the next step. After that, the following files should be generated: `example.com.csr`, `example.com.key`.

```console
    OpenSSL> x509 -req -in example.com.csr -CA rootSSL.pem -CAkey rootSSL.key -CAcreateserial -out example.com.crt -days 500 -sha256
```

This should generate the signed `example.com.crt` file. In the next step, we will *trust* this certificate:

> Powershell users can run the [New-SelfSignedCertificate](https://docs.microsoft.com/powershell/module/pkiclient/new-selfsignedcertificate?view=win10-ps) command:
>
> ```powershell
>$cert=New-SelfSignedCertificate -Subject "CN=DaemonConsoleCert" -CertStoreLocation "Cert:\CurrentUser\My"  -KeyExportPolicy Exportable -KeySpec Signature
>```
>
> Extensions: *.crt*, *.csr*, *.cer*, *.pem*, *.pfx*, *.key*

### Trusting self-signed certificates

* For Windows users, follow the guide here: [Installing the trusted root certificate](https://docs.microsoft.com/skype-sdk/sdn/articles/installing-the-trusted-root-certificate).

> Alternatively, see: [How to: View certificates with the MMC snap-in](https://docs.microsoft.com/dotnet/framework/wcf/feature-details/how-to-view-certificates-with-the-mmc-snap-in)

* For MacOS users, follow the guide here: [ENTER_NAME_HERE](ENTER_LINK_HERE).

> :warning: You might need **administrator** privileges for running the commands above.

### Registering self-signed certificates

In the Azure AD app registration for the client application:

1. Select **Certificates & secrets**.
2. Click on **Upload** certificate and select the certificate file to upload.
3. Click **Add**. Once the certificate is uploaded, the *thumbprint*, *start date*, and *expiration* values are displayed.

For more information, see: [Register your certificate with Microsoft identity platform](https://docs.microsoft.com/azure/active-directory/develop/active-directory-certificate-credentials#register-your-certificate-with-microsoft-identity-platform)

### Initializing MSAL Node with certificates

```javascript
const msal = require('@azure/msal-node');

// Before running the sample, you will need to replace the values in the config
const config = {
    auth: {
        clientId: "YOUR_CLIENT_ID",
        authority: "https://login.microsoftonline.com/YOUR_TENANT_ID",
        clientCertificate: {
            thumbprint: "CERT_THUMBPRINT",
            privateKey: "CERT_PRIVATE_KEY",
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
```

You may need to extract private key from a **PEM** file. This can be done as follows:

```javascript
const fs = require('fs');
const crypto = require('crypto');

const privateKeySource = fs.readFileSync('./NodeWebCert.pem')

const privateKeyObject = crypto.createPrivateKey({
    key: privateKeySource,
    passphrase: "YOUR_PASSPHRASE",
    format: 'pem'
});

const privateKey = privateKeyObject.export({
    format: 'pem',
    type: 'pkcs8'
});
```

### Creating an HTTPS server in Node.js

Setup a **HTTPS** server by importing the generated **certificate** and **public key** files and passing them as `options` to `https.createServer()` method. This is shown below:

```javascript
    const express = require('express');
    const https = require('https');
    const fs = require('fs');

    const DEFAULT_PORT = process.env.PORT || 5000;
    
    // initialize express.
    const app = express();
    
    const options = {
        key: fs.readFileSync(path.join(__dirname + "/example.com.key")),
        cert: fs.readFileSync(path.join(__dirname + "/example.com.crt"))
    };
    
    const server = https.createServer(options, app);
    
    server.listen(port, () => {
        console.log("server started on port : " + DEFAULT_PORT)
    });
```

## Using Azure Key Vault

### Create a key vault and import certificates

First, create a key vault. Follow the guide: [Quickstart: Create a key vault using the Azure portal](https://docs.microsoft.com/azure/key-vault/general/quick-create-portal#create-a-vault)

> :information_source: In addition to certificates, **Azure Key Vault** can also be used for storing secrets and other sensitive information such as database connection strings and etc.

Now you can upload your certificate to Key Vault:

1. Step1
2. Step2

### Get certificate from your vault in Node.js

Using Azure Key Vault JavaScript SDKs, we can fetch the certificate we've uploaded in the previous step. During development, Azure Key Vault JavaScript SDKs grabs the required access token from the local environment using VS Code's context, via [@azure/identity](https://docs.microsoft.com/javascript/api/overview/azure/identity-readme?view=azure-node-latest) package. To do this, you'll need to be signed in Azure.

First, [download and install](https://docs.microsoft.com/cli/azure/install-azure-cli) **Azure CLI**. This should add **Azure CLI** to system path. Re-launch VS Code and **Azure CLI** should be available in VS Code [integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal). Then, type the following to sign-in.

```console
az login --tenant YOUR_TENANT_ID
```

Once authenticated, [@azure/identity](https://docs.microsoft.com/javascript/api/overview/azure/identity-readme?view=azure-node-latest) package can access the Azure Key Vault as shown below:

```javascript
const identity = require("@azure/identity");
const keyvault = require("@azure/keyvault-certificates");

const keyVaultName = process.env["KEY_VAULT_NAME"] || "YOUR_KEY_VAULT_NAME";
const KVUri = "https://" + keyVaultName + ".vault.azure.net";

const credential = new identity.DefaultAzureCredential();
const client = new keyvault.CertificateClient(KVUri, credential);

client.getCertificate("NodeWebCert").then((response) => {
    let thumbprint = response.properties.x509Thumbprint.toString('hex').toUpperCase();
    console.log(thumbprint);
});
```

## Using Azure Managed Identity

While developing on local environment you may use Azure Key Vault JavaScript SDKs, you should use **Azure Managed Identity** for production and deployment.

> Take a moment to get familiar with Managed Identity: [What are managed identities for Azure resources?](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview#how-a-system-assigned-managed-identity-works-with-an-azure-vm)

For more information, visit: [How to use managed identities for App Service](https://docs.microsoft.com/azure/app-service/overview-managed-identity?context=%2Fazure%2Factive-directory%2Fmanaged-identities-azure-resources%2Fcontext%2Fmsi-context&tabs=dotnet)

### Deployment to App Service

## More Information

* [Microsoft identity platform application authentication certificate credentials](https://docs.microsoft.com/azure/active-directory/develop/active-directory-certificate-credentials)
* [Azure Key Vault Developer's Guide](https://docs.microsoft.com/azure/key-vault/general/developers-guide)