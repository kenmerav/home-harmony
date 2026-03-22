#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/kenmerav/home-harmony.git"
TARGET_DIR_DEFAULT="$HOME/Documents/New project"
NODE_MAJOR_DEFAULT="20"

print_header() {
  echo ""
  echo "==> $1"
}

prompt_with_default() {
  local prompt="$1"
  local default="$2"
  local result=""
  read -r -p "$prompt [$default]: " result || true
  if [[ -z "${result}" ]]; then
    result="$default"
  fi
  printf '%s' "$result"
}

ensure_line_in_file() {
  local file_path="$1"
  local line="$2"
  touch "$file_path"
  if ! grep -Fq "$line" "$file_path"; then
    echo "$line" >> "$file_path"
  fi
}

print_header "Home Harmony new Mac bootstrap"
echo "This script installs toolchain, clones the repo, installs deps, and prints remaining manual steps."

REPO_URL="$(prompt_with_default "Repo URL" "$REPO_URL_DEFAULT")"
TARGET_DIR="$(prompt_with_default "Project folder" "$TARGET_DIR_DEFAULT")"
NODE_MAJOR="$(prompt_with_default "Node major version" "$NODE_MAJOR_DEFAULT")"

print_header "Install Homebrew (if needed)"
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

BREW_PREFIX="$(brew --prefix)"

print_header "Install required CLI tools"
brew install git gh nvm vercel
brew install supabase/tap/supabase

print_header "Configure nvm"
ZSHRC="$HOME/.zshrc"
ensure_line_in_file "$ZSHRC" 'export NVM_DIR="$HOME/.nvm"'

if [[ -f "$BREW_PREFIX/opt/nvm/nvm.sh" ]]; then
  ensure_line_in_file "$ZSHRC" "[ -s \"$BREW_PREFIX/opt/nvm/nvm.sh\" ] && . \"$BREW_PREFIX/opt/nvm/nvm.sh\""
fi

export NVM_DIR="$HOME/.nvm"
mkdir -p "$NVM_DIR"
if [[ -f "$BREW_PREFIX/opt/nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$BREW_PREFIX/opt/nvm/nvm.sh"
else
  echo "nvm.sh not found at $BREW_PREFIX/opt/nvm/nvm.sh"
  echo "Open a new terminal and run this script again."
  exit 1
fi

nvm install "$NODE_MAJOR"
nvm alias default "$NODE_MAJOR"

print_header "GitHub auth"
if ! gh auth status >/dev/null 2>&1; then
  gh auth login -w
fi

print_header "Clone or update repo"
if [[ -d "$TARGET_DIR/.git" ]]; then
  git -C "$TARGET_DIR" pull --ff-only
else
  mkdir -p "$(dirname "$TARGET_DIR")"
  gh repo clone kenmerav/home-harmony "$TARGET_DIR"
fi

print_header "Install npm dependencies"
cd "$TARGET_DIR"
npm ci

print_header "Set Git identity (optional but recommended)"
CURRENT_NAME="$(git config --global user.name || true)"
CURRENT_EMAIL="$(git config --global user.email || true)"
echo "Current git name:  ${CURRENT_NAME:-<not set>}"
echo "Current git email: ${CURRENT_EMAIL:-<not set>}"
read -r -p "Set git user.name now? (y/N): " SET_GIT_NAME || true
if [[ "${SET_GIT_NAME,,}" == "y" ]]; then
  read -r -p "Git user.name: " NEW_GIT_NAME
  if [[ -n "$NEW_GIT_NAME" ]]; then
    git config --global user.name "$NEW_GIT_NAME"
  fi
fi

read -r -p "Set git user.email now? (y/N): " SET_GIT_EMAIL || true
if [[ "${SET_GIT_EMAIL,,}" == "y" ]]; then
  read -r -p "Git user.email: " NEW_GIT_EMAIL
  if [[ -n "$NEW_GIT_EMAIL" ]]; then
    git config --global user.email "$NEW_GIT_EMAIL"
  fi
fi

print_header "Bootstrap complete"
cat <<EOF
Next steps (manual, ~5 minutes):
1) Copy env values into:
   $TARGET_DIR/.env.local
   Required VITE vars:
   - VITE_SUPABASE_PROJECT_ID
   - VITE_SUPABASE_PUBLISHABLE_KEY
   - VITE_SUPABASE_URL

2) Link Supabase project:
   cd "$TARGET_DIR"
   supabase login
   supabase link --project-ref amhnbyimvgykklzrenky

3) Pull Vercel env (if deploying from this Mac):
   cd "$TARGET_DIR"
   vercel login
   vercel link
   vercel env pull .env.vercel.local

4) Run app:
   cd "$TARGET_DIR"
   npm run dev

5) Optional sanity check:
   npm run build
EOF
