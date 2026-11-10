# MAAI / 間合い

A presenter-led invitation to a dance collective. Eight slides and a conversation guide, built with HTML, CSS and JavaScript. No build step or external assets.

[Open the presentation](https://grazorite.github.io/maai/)

## Present

Open the link in your browser. On iPad, use landscape and tap the arrow buttons.

| Control | Action |
| --- | --- |
| ← / →, Page Up / Page Down | Previous / next slide |
| Home / End | First / last slide |
| O | Slide overview |
| N | Presenter notes |
| F | Fullscreen, where supported |
| Esc | Close a popup |

Notes appear on the same screen. Before we begin opens the conversation guide. Slides never advance automatically. No answers are collected or saved.

## Work locally

Open `index.html` directly, or run this from the project folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8765. Press Control-C to stop the preview.

## Publish an update

GitHub Pages publishes the root of `main`. After reviewing your changes:

```sh
node --check script.js
git add index.html styles.css script.js conversation-guide.html README.md .gitignore .nojekyll
git diff --cached
git commit -m "Update presentation"
git push origin main
```

Check the repository’s Actions tab for deployment status, then refresh the presentation link.

## Files

- `index.html`: slides and spoken presenter notes.
- `conversation-guide.html`: opening conversation questions.
- `styles.css`: black/lilac visual system, layouts and motion.
- `script.js`: navigation, dialogs and interactive choices.

This public repository currently contains only the presentation and its guide. The allowlist in `.gitignore` keeps other local files out of ordinary commits. Add future training material deliberately when it is ready to share.
