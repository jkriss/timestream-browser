#! /usr/bin/env node

import blessed from "blessed";
import fetch from "node-fetch";
import { URL } from "url";
import parseLinkHeader from "./parse-link-header.js";
import tmp from "tmp-promise";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import marked from "marked";
import TerminalRenderer from "marked-terminal";
import chalk from "chalk";
import fm from "front-matter";

tmp.setGracefulCleanup();
const streamPipeline = promisify(pipeline);

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer({
    firstHeading: chalk.bold,
    link: chalk.bold,
    hr: () => "---",
  }),
});

class Display {
  constructor() {
    this.history = [];
    this.historyPosition = 0;
    const screen = blessed.screen({
      smartCSR: true,
    });

    screen.title = "timestreams";

    // Create a box perfectly centered horizontally and vertically.
    var box = blessed.box({
      top: "center",
      left: "center",
      width: "100%",
      height: "100%",
      content: "Hello {bold}world{/bold}!",
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      padding: {
        top: 1,
        left: 2,
        right: 2,
        style: {
          bottom: 1,
        },
        bg: "#222",
      },
    });

    // Append our box to the screen.
    screen.append(box);
    // Quit on Escape, q, or Control-C.
    screen.key(["escape", "q", "C-c"], function (ch, key) {
      return process.exit(0);
    });

    // use arrow keys to navigate
    screen.key(["right"], () => {
      this.loadPrevious();
    });
    screen.key(["left"], () => {
      this.back();
    });

    // Focus our element.
    box.focus();

    // Render the screen.
    screen.render();
    this.screen = screen;
    this.box = box;
  }
  showText(text) {
    this.box.setContent(text);
    this.screen.render();
  }
  loadPrevious() {
    if (this.previousPost) this.navigate(this.previousPost);
  }
  back() {
    if (this.historyPosition > 0) {
      this.historyPosition = this.historyPosition - 1;
    }
    this.get(this.history[this.historyPosition]);
  }
  navigate(url) {
    this.history.push(url);
    this.historyPosition = this.history.length - 1;
    this.get(url);
  }
  async asFile(res, ext) {
    const f = await tmp.file({ postfix: ext });
    await streamPipeline(res.body, fs.createWriteStream(f.path));
    return f.path;
  }
  async get(url) {
    let content = `Welcome!`;
    if (url) this.showText(`loading ${url}...`);
    const res = await fetch(url);
    if (res && res.ok) {
      content = "";
      const type = res.headers.get("content-type");
      if (type && type.startsWith("text")) {
        const text = await res.text();
        if (res.headers.get("Post-Time")) {
          content += `{bold}${res.headers.get("Post-Time")}{/bold}\n\n`;
        }

        if (type.startsWith("text/plain")) {
          content += text;
        } else if (type.startsWith("text/markdown")) {
          content += marked(fm(text).body);
        }
      } else if (type.startsWith("image")) {
        // shell out to termpix for this?

        // let imageFile = await this.asFile(res, ".jpeg");
        // let imageFile = './tmpfile.png'
        // console.log("image at", imageFile)
        // const img = blessed.image({
        //   parent: this.box,
        //   top: 4,
        //   left: 0,
        //   // ascii: true,
        //   // type: 'overlay',
        //   width: "shrink",
        //   height: "shrink",
        //   file: imageFile,
        //   search: false,
        // });
        // content = `this is an image? ${imageFile}`;
        content += `Sorry, can't handle images just yet`;
      } else {
        content = `Don't know how to display ${type}`;
      }

      if (res.headers.get("Link")) {
        const links = parseLinkHeader(res.headers.get("Link"));
        const previous = links && links.find((link) => link.rel === "previous");
        if (previous) {
          content += `\n\n--\npress the right arrow to continue ->\n`;
          this.previousPost = new URL(previous.url, url).href;
        }
      }
    } else if (url) {
      content = `Error loading ${url}`;
    }
    this.showText(content);
  }
}

const d = new Display();
d.navigate(process.argv.slice(2)[0] || "https://timestreams.org/status");
