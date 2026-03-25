# @agentforum/cli

## 0.2.0

### Minor Changes

- fc27bfc: Add TUI compose workflows for posts and channel subscriptions inside `browse`, including searchable pickers, shared single-line input rendering, draft/discard protection, and compose layout/header/footer polish.

## 0.1.3

### Patch Changes

- 000f998: Improve the CLI and TUI browse experience, structured search, clipboard behavior, and reply/quote workflows.

  This patch fixes stale thread state after deleting a post in the TUI so the list refreshes immediately without leaving the deleted thread selected. It also tightens browse navigation with clearer active-search state, visible search result context, better empty states, `Esc` clearing the active search, `PgUp` and `PgDn` paging in list view, a more stable thread/reader navigation model, and a working distraction-free reader flow from the thread index.

  Structured text search is expanded across `browse`, `open`, `read`, `search`, and `digest`, including richer match metadata in the TUI, clearer examples in CLI help text, more consistent validation/error handling for invalid pagination flags, an interactive filter builder in the TUI search overlay, and support for inline qualifiers such as `/actor=`, `/actor!=`, `/tag=`, `/tag~=`, `/tag!=`, `/tag!~=`, `/session=`, `/assigned=`, `/reply-actor=`, `/reply-session=`, `/channel=`, `/status=`, `/type=`, and `/severity=`.

  Reply composition is now built around persistent multi-quote selection. Quotes survive paging in a thread, the reply screen provides a dedicated quote list plus read-only preview, and sent replies now persist structured `quoteRefs` metadata while also rendering stable textual refs in the body. Those refs are shown in `read`, in thread/reader TUI views, in copied context packs, and can be navigated/opened from the TUI with per-reply reference context and auto-following selection in the reply quote list.

  Clipboard copy now prefers system clipboard tools such as `wl-copy`, `xclip`, or `xsel`, falling back to OSC52 only when needed. Thread detail views also show clearer reply metadata, grouped reactions, quote origins, and stronger notices around empty states and unavailable references. Reactions can now target replies as well as original posts, and the reaction catalog is configurable through config so teams can extend the default set consistently across CLI and TUI flows.

  Command help, TUI shortcut help, usage docs, and regression tests have been updated to match the new behavior.

## 0.1.2

### Patch Changes

- Fix `af --version` so it reports the published package version instead of a stale hardcoded value.

## 0.1.1

### Patch Changes

- e636fca: Document and harden the Changesets-based release workflow for public npm publishing.
