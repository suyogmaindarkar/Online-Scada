# Factory Connector release checklist

## Recommended public URL

Use the optional subdomain:

```text
https://connector.onlinescada.in/OnlineSCADA-Factory-Connector-Setup.exe
```

Point `connector.onlinescada.in` at the HTTPS host that serves the signed installer. The host can be a static artifact bucket, CDN, or release-download service. The application does not require this subdomain for the authorization flow; it is only the installer download location.

Configure the frontend deployment with:

```text
VITE_CONNECTOR_INSTALLER_URL=https://connector.onlinescada.in/OnlineSCADA-Factory-Connector-Setup.exe
```

Keep the backend and application frontend URLs separate:

```text
FRONTEND_URL=https://<application-frontend-domain>
BACKEND_URL=https://<application-backend-domain>
```

`FRONTEND_URL` is used to create the browser approval URL. It must point to the deployed application that contains `/connector/authorize`; it must not point to the installer-download subdomain.

## Release checklist

1. Build a signed installer on a Windows release machine with Inno Setup installed:

   ```text
   installer\build-installer.bat
   ```

2. Upload `installer\Output\OnlineSCADA-Factory-Connector-Setup.exe` to the public HTTPS artifact host.
3. Verify the exact URL downloads the signed `.exe` without authentication.
4. Set `VITE_CONNECTOR_INSTALLER_URL` in the frontend deployment and redeploy.
5. Verify the browser setup dialog says `Download Windows Installer`, not `Download fallback package`.
6. Test on a clean Windows machine:

   ```text
   Run installer
   → browser approval page opens
   → sign in as an administrator or engineer
   → approve the named factory computer
   → protected configuration is saved
   → Windows service starts
   → website shows Factory Connector online
   ```

The ZIP package remains available as a support/developer fallback. It is not the recommended customer path.
