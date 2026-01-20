# Azure App Service Deployment Guide

This guide describes how to deploy the application to Microsoft Azure App Service.

## Prerequisites

- An Azure account.
- Azure CLI (optional, but recommended).
- GitHub repository connected to the application.

## Deployment Methods

You can deploy this application using **Code** (Node.js) or **Docker Container**. Both methods are supported.

### Option 1: Code Deployment (Recommended for simplicity)

This method lets Azure build the application from source.

1.  **Create an Azure App Service (Web App)**
    -   **Publish**: Code
    -   **Runtime stack**: Node 20 LTS
    -   **Operating System**: Linux
    -   **Plan**: Basic (B1) or higher recommended for performance.

2.  **Configure Deployment**
    -   Go to **Deployment Center** in the Azure Portal.
    -   Select **Source**: GitHub.
    -   Select your repository and branch.
    -   Azure will automatically detect `package.json` and create a workflow.
    -   **Important**: The `package.json` has been updated so that `npm run build` triggers the web build (`npm run build:web`). Azure will run this automatically.

3.  **Startup Command**
    -   By default, Azure runs `npm start`. This executes `node server/index.js`, which is correct.
    -   If needed, you can explicitly set the **Startup Command** in **Configuration** > **General Settings** to:
        ```bash
        node server/index.js
        ```

### Option 2: Docker Deployment

This method uses the `Dockerfile` provided in the repository.

1.  **Create an Azure App Service (Web App)**
    -   **Publish**: Docker Container
    -   **Operating System**: Linux

2.  **Configure Docker**
    -   You can build the image locally and push to Azure Container Registry (ACR) or Docker Hub.
    -   Or configure **Deployment Center** to build from Dockerfile in the repo.

3.  **Build & Push (Manual)**
    ```bash
    # Build image
    docker build -t <your-registry>/shreenathji-app:latest .

    # Push image
    docker push <your-registry>/shreenathji-app:latest
    ```

## Environment Variables

You must configure the following **Application Settings** in the Azure Portal (Configuration > Environment Variables):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PARSE_APPLICATION_ID` | Back4App Application ID | `...` |
| `PARSE_JAVASCRIPT_KEY` | Back4App JS Key | `...` |
| `PARSE_MASTER_KEY` | Back4App Master Key | `...` |
| `PARSE_SERVER_URL` | Back4App Server URL | `https://parseapi.back4app.com/` |
| `PORT` | (Optional) Port to listen on. Azure sets this automatically. | `8080` (Azure sets this) |

## OAuth Configuration (Critical)

After deploying, you must update your OAuth providers (Google Cloud Console, Azure AD, etc.) with the new callback URL.

1.  **Get your Azure URL**: `https://<your-app-name>.azurewebsites.net`
2.  **Redirect URI format**:
    ```
    https://<your-app-name>.azurewebsites.net/api/oauth/callback
    ```
3.  **Update Google/Microsoft Consoles**: Add this URI to the "Authorized Redirect URIs".

## Troubleshooting

-   **Application Error**: Check **Log Stream** in Azure Portal.
-   **Static Files Not Found**: Ensure the build process ran correctly. The server expects `build/index.html`.
-   **Port Issues**: Ensure the application listens on `process.env.PORT`. The server is configured to do this (`const PORT = process.env.PORT || 4000`).

## Performance Tips

-   Scale up the App Service Plan if the application is slow.
-   Enable "Always On" in Configuration > General Settings to prevent the app from idling out.
