@echo off
SET /P NEW_VERSION="Enter target release version (e.g. 0.1.1): "

echo Updating package versions...
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"
powershell -Command "(Get-Content src-tauri/tauri.conf.json) -replace '\"version\": \".*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content src-tauri/tauri.conf.json"

echo Committing version changes to Git...
git add package.json src-tauri/tauri.conf.json
git commit -m "Bump version to v%NEW_VERSION%"
git tag -a v%NEW_VERSION% -m "Release v%NEW_VERSION%"
// FIX: Changed main to master to match your branch layout
git push origin master --tags

echo Compiling signed production builds...
// FIX: Removed quotes surrounding key assignment mapping block
set TAURI_SIGNING_PRIVATE_KEY=dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5TUhGZi9aUENiRnVVSE9FSmJ6dGpoL2hIbUpuMWd0QjdMekFQZVZIZUlvd0FBQkFBQUFBQUFBQUFBQUlBQUFBQStJTXVXUGVOa3U1NFV3REszM3U3NitpWUZLcC9vRkJoaVVIVnloM0FIb0VMMzJGUUx1SWNKYkdNS21kVFBFZ0F1TERrZjMrYzZyOHNxdGVEb2IvMWRDejRaSHlwSSsyeWs4VVA1L3M4MDkxaFpWYVQ0VVVoazlZK3BXbWRlcVBqcDVVWExWZjRDVGM9Cg==


npx tauri build

echo Production builds finished. Please upload your installer assets from 'src-tauri/target/release/bundle/' directly to your new GitHub Release tag!
