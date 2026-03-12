# Auto-Save Feature Explained

## How Settings Auto-Save Works

Your settings **automatically save** as you make changes - there's **no save button** needed!

### Visual Feedback

In the Settings page header, you'll see one of these status messages:

1. **💾 Saving changes...** - Your changes are being saved (appears for 1 second)
2. **✅ All changes saved just now** - Save completed successfully
3. **✅ All changes saved 5 seconds ago** - Shows how long ago the last save was
4. **Changes are saved automatically** - Default message when no changes have been made

### How It Works

When you change ANY setting:

1. **Immediate localStorage save** (instant)
   - Saves to your browser's localStorage
   - Ensures changes persist even if backend fails

2. **Debounced backend save** (1 second delay)
   - Waits 1 second for more changes
   - Saves to individual JSON files in `/data/settings/`
   - Provides persistent storage across browser sessions

### What Gets Saved

Everything you change in the Settings page:

- **Mode** (Roleplay vs Normal/Utility)
- **Templates** (when you apply a template)
- **Roleplay Settings** (world, characters, narrative)
- **Utility Settings** (assistant identity, guardrails)
- **User Persona** (your name, bio, preferences)
- **General Settings** (model, temperature, top_p, max_tokens)

### When Settings Are Saved

Settings save automatically when you:
- Select a different mode
- Apply a template
- Change any text field
- Upload an avatar image
- Add/remove tags
- Adjust sliders
- Toggle checkboxes

### Verification

You can verify settings are saving by:

1. **Visual Status** - Watch the status message in the header
2. **Browser Console** - Open DevTools and check for:
   - `✅ Settings saved to localStorage`
   - `💾 Saving settings to backend...`
   - `✅ Settings saved to backend successfully`

3. **File System** - Check `/data/settings/` folder for updated JSON files

### No Save Button Needed!

Unlike traditional apps with a "Save" button, this app uses **auto-save** to ensure you never lose your work. Every change is automatically persisted.

This is the modern approach used by apps like:
- Google Docs (saves as you type)
- Notion (auto-saves changes)
- Figma (saves every action)

---

## Troubleshooting

**Q: I don't see my changes reflected**
- Check the save status message
- Look in browser console for save confirmations
- Verify `/data/settings/` contains updated files

**Q: Settings not saving?**
- Ensure backend server is running on port 3001
- Check browser console for errors
- Verify you have write permissions to `/data/settings/`

**Q: Want to manually save?**
- Settings auto-save automatically - no manual action needed
- Use "Export Settings" to create a backup JSON file

---

**Last Updated**: 2026-03-12
