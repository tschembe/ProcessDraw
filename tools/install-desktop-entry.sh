#!/bin/sh
# Installs a desktop entry for running ProcessDraw from this source checkout (Linux).
# GNOME on Wayland takes the dock/taskbar icon from the .desktop file whose name matches the
# window's app id (package.json desktopName = processdraw.desktop), not from the window icon.
# Packaged builds (deb, AppImage) install their own entry; this is only for `npm start`.
# Remove with: rm ~/.local/share/applications/processdraw.desktop
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$DIR"
cat > "$DIR/processdraw.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=ProcessDraw
Comment=PFD and P&ID editor
Exec="$ROOT/node_modules/.bin/electron" "$ROOT" %F
Path=$ROOT
Icon=$ROOT/build/512x512.png
Terminal=false
Categories=Graphics;Engineering;
MimeType=application/vnd.jgraph.mxfile;
StartupWMClass=ProcessDraw
EOF
update-desktop-database "$DIR" 2>/dev/null || true
echo "Installed $DIR/processdraw.desktop"
