import {
  AgentEvent,
  FILE_OPEN,
  FILE_CLOSE,
  DELETE_TAG,
} from "./protocol";

// Incremental parser: feed it streamed model text, get back discrete events.
// It carefully holds back partial tags that straddle chunk boundaries so a tag
// split across two network chunks is never mis-emitted as prose.
export class StreamParser {
  private mode: "text" | "file" = "text";
  private buf = "";
  private path = "";
  private content = "";

  feed(chunk: string): AgentEvent[] {
    this.buf += chunk;
    return this.drain(false);
  }

  end(): AgentEvent[] {
    const events = this.drain(true);
    if (this.mode === "file") {
      // Unterminated file block — emit what we have rather than lose it.
      events.push({ type: "file-close", path: this.path, content: this.content });
      this.mode = "text";
    } else if (this.buf) {
      events.push({ type: "text", delta: this.buf });
      this.buf = "";
    }
    return events;
  }

  private drain(final: boolean): AgentEvent[] {
    const events: AgentEvent[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.mode === "text") {
        const open = FILE_OPEN.exec(this.buf);
        const del = DELETE_TAG.exec(this.buf);
        // Pick whichever complete tag appears first.
        const next =
          open && del
            ? open.index <= del.index
              ? { kind: "open" as const, m: open }
              : { kind: "del" as const, m: del }
            : open
              ? { kind: "open" as const, m: open }
              : del
                ? { kind: "del" as const, m: del }
                : null;

        if (next) {
          const before = this.buf.slice(0, next.m.index);
          if (before) events.push({ type: "text", delta: before });
          this.buf = this.buf.slice(next.m.index + next.m[0].length);
          if (next.kind === "open") {
            this.mode = "file";
            this.path = next.m[1];
            this.content = "";
            events.push({ type: "file-open", path: next.m[1] });
          } else {
            events.push({ type: "delete", path: next.m[1] });
          }
          continue;
        }

        // No complete tag. Emit safe prose, keep any possible partial tag.
        const hold = final ? -1 : partialTagStart(this.buf);
        if (hold === -1) {
          if (this.buf) events.push({ type: "text", delta: this.buf });
          this.buf = "";
        } else {
          const before = this.buf.slice(0, hold);
          if (before) events.push({ type: "text", delta: before });
          this.buf = this.buf.slice(hold);
        }
        break;
      } else {
        // mode === "file": accumulate content until the close tag.
        const i = this.buf.indexOf(FILE_CLOSE);
        if (i !== -1) {
          this.content += this.buf.slice(0, i);
          this.buf = this.buf.slice(i + FILE_CLOSE.length);
          events.push({ type: "file-close", path: this.path, content: this.content });
          this.mode = "text";
          continue;
        }
        // Hold back a possible partial "</expoFile>" at the tail.
        const hold = final ? -1 : partialCloseStart(this.buf);
        if (hold === -1) {
          this.content += this.buf;
          this.buf = "";
        } else {
          this.content += this.buf.slice(0, hold);
          this.buf = this.buf.slice(hold);
        }
        break;
      }
    }

    return events;
  }
}

// Return the index of a trailing substring that could be the start of an open
// or delete tag, or -1 if the tail is safe to emit as prose.
function partialTagStart(buf: string): number {
  const lt = buf.lastIndexOf("<");
  if (lt === -1) return -1;
  const frag = buf.slice(lt);
  // A complete-but-unmatched tag would already have been handled; if this frag
  // has a closing '>' it isn't one of ours, so it's safe prose.
  if (frag.includes(">")) return -1;
  if (isPrefix(frag, "<expoFile") || isPrefix(frag, "<expoDelete")) return lt;
  return -1;
}

function partialCloseStart(buf: string): number {
  const lt = buf.lastIndexOf("<");
  if (lt === -1) return -1;
  const frag = buf.slice(lt);
  if (frag.includes(">")) return -1;
  return isPrefix(frag, FILE_CLOSE) ? lt : -1;
}

// True if `frag` is a prefix of `full`, or `full` is a prefix of `frag`
// (the latter meaning we have the tag name but are still reading attributes).
function isPrefix(frag: string, full: string): boolean {
  return full.startsWith(frag) || frag.startsWith(full);
}
