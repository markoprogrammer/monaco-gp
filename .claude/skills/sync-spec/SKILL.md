---
name: sync-spec
description: Sync game design spec from the wiki session
disable-model-invocation: true
---

# Sync Spec from Wiki

When invoked:

1. Read the game spec from `docs/spec.md`
2. Check the "Last sync" date at the top
3. If the user says something changed, ask what and update the spec
4. Adapt implementation to match any spec changes

The wiki session at `~/Documents/obsidian-workspace/my-vault/` is the source of truth for game design decisions. The spec file `docs/spec.md` is the bridge between wiki (planning) and code (execution).

If the user made design changes in the wiki session, they should tell you what changed so you can update `docs/spec.md` and adjust the code accordingly.
