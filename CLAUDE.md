# BRB — Marshall Comics · Claude Code Notes

## Branch
All development: `claude/upbeat-babbage-2f5gr2`

## Write protocol
- xlsx is the source of truth on Mac — Claude never writes to it
- Only Python outputs (JSON, CSV) and TS data files belong in the repo
- Check the Data Integrity Log tab before flagging row drops as data loss

## Mac one-time setup (do these once, not per session)

### eBay auth — add to ~/.zshrc
Keep the real values ONLY in ~/.zshrc (never commit them). The cert that used
to live here has been scrubbed — rotate it in the eBay developer console if it
was ever pushed, since it remains in git history.
```
export EBAY_APP_ID=<your eBay App ID>
export EBAY_CERT_ID=<your eBay Cert ID>
```
Then: `source ~/.zshrc`

### Prevent git editor loop on merge commits
```
git config --global core.editor "true"
```

### Before pushing from Mac — always fetch first
```
git pull --rebase origin claude/upbeat-babbage-2f5gr2
```

## Terminal habits
- Run nohup and echo PID as two separate commands — never chained on one line
- Use straight ASCII quotes in all terminal commands (smart/curly quotes cause dquote> errors in zsh)

## BOX_STATUS_ALLOWLIST (shared across all scripts)
```python
BOX_STATUS_ALLOWLIST = {
    "AT CGC",
    "AT MAGIC PRESSING → CGC",
    "AT CGC — Roy Thomas SS",
    "UNKNOWN — needs physical reassignment",
}
```

## BOX_CAPACITY
- Default: 240
- Exceptions: {15:150, 23:155, 40:80, 44:200, 72:80, 85:155}
- Over-capacity triggers a logged warning, not a crash

## Duplicate key (must match Mac validator)
- Rule 2 (same-box): `title.lower() + "|" + issue + "|" + year + "|" + box`
- Rule 3 (cross-box): `title.lower() + "|" + issue + "|" + year`

## eBay pipeline status (July 6, 2026)
- Step 5 done: 1,313 comics have eBay_Avg/Low/High/Count in data3.ts
- Step 6 next: surface eBay prices in app UI (comic drawer / BoxKeys)
- Step 7 next: deploy
