# CopyCat

A modern, lightweight clipboard manager for organizing and quickly accessing text snippets. Built with React, Tauri, and dnd-kit for a seamless desktop experience.

## Features

- 📋 **Snippet Management** — Create, edit, and organize text snippets in custom categories
- 🔄 **Drag & Drop Reordering** — Easily reorder snippets within categories with smooth animations
- 🎨 **Custom Categories** — Create color-coded categories to organize your snippets
- 📝 **Notes** — Keep separate notes with a dedicated editor and save/edit workflow
- 🔍 **Fast Search** — Search across all snippets instantly
- ⌨️ **Global Hotkey** — Quick access with `Ctrl/Cmd+Shift+S` (configurable)
- ⚡ **Vanish on Copy** — Optional auto-hide window after copying (configurable)
- ⚙️ **Settings** — Customize behavior: toggle vanish-on-copy and global shortcut
- 💾 **Local Persistence** — All data stored locally in your system's app data directory
- 🎯 **Minimal UI** — Clean, modern design with modern scrollbars and intuitive controls

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
git clone https://github.com/chamiruuu/CopyCat.git
cd CopyCat
npm install
```

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Usage

### Managing Snippets
1. Click **"New Snippet"** to create a new snippet
2. Enter a title, select or create a category, and paste your text
3. Click **Save** to store the snippet

### Organizing Snippets
- **Drag & Drop**: Click and drag the grip handle (≡) to reorder snippets within a category
- **Search**: Use the search bar to filter snippets by title or content
- **Categories**: View all snippets in a category or switch to "All" for a masonry view

### Copying Snippets
- Click any snippet card to copy it to your clipboard
- The "Copied to clipboard" confirmation appears
- Window optionally auto-hides after copying (if enabled in Settings)

### Notes
- Click the **Notes** tab in the sidebar
- Create a new note or click an existing note to edit
- Unsaved changes trigger a confirmation prompt on close

### Settings
- Click the **Settings** icon (⚙️) in the header
- Toggle "Vanish after copy" to control auto-hide behavior
- Toggle "Global shortcut" to enable/disable the `Ctrl/Cmd+Shift+S` hotkey
- Click **Save** to persist your preferences

## Data Storage

All data (snippets, categories, notes, and settings) is stored locally:
- **Windows**: `%APPDATA%\CopyCat\`
- **macOS**: `~/Library/Application Support/CopyCat/`
- **Linux**: `~/.local/share/CopyCat/`

Files:
- `copycat_data.json` — Snippets
- `copycat_cats.json` — Categories
- `copycat_notes.json` — Notes
- `copycat_settings.json` — User settings

## Technology Stack

- **Frontend**: React (Vite)
- **Desktop Framework**: Tauri
- **Styling**: Tailwind CSS
- **Drag & Drop**: dnd-kit (@dnd-kit/core, @dnd-kit/sortable)
- **Icons**: lucide-react
- **Build Tool**: Vite

## Development

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Project Structure

```
CopyCat/
├── src/                    # React frontend
│   ├── App.jsx            # Main app component
│   ├── App.css            # Styles (Tailwind)
│   ├── main.jsx           # Entry point
│   └── assets/            # Images, icons
├── src-tauri/             # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs        # Tauri window setup
│   │   └── lib.rs         # Tauri commands
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── package.json           # Node dependencies
├── vite.config.js         # Vite config
├── tailwind.config.js     # Tailwind config
└── README.md              # This file
```

## Features In Detail

### Drag & Drop
- Uses dnd-kit for robust, smooth reordering
- Works within a selected category (All view is read-only masonry)
- Visual feedback with drag handle (grip icon)
- Smooth animations with CSS transitions
- DragOverlay shows a preview while dragging

### Settings Persistence
- All settings (vanish-on-copy, global shortcut) saved to `copycat_settings.json`
- Loaded on app startup
- Global shortcut registration/unregistration syncs with setting changes

### Notes Editor
- Full WYSIWYG editor with title and content fields
- Dirty-state detection — unsaved changes trigger a confirmation
- Custom in-app modal (no browser alerts)
- Auto-select active note when editing

### Modern UI
- Minimal scrollbars with subtle hover effects (WebKit + Firefox)
- Responsive layout that adapts to window size
- Teal/emerald accents for active states
- Smooth transitions throughout

## License

MIT License

## Contributing

Contributions are welcome! Please open issues or submit pull requests.

## Support

Have questions or found a bug? Open an issue on [GitHub](https://github.com/chamiruuu/CopyCat/issues).

---
