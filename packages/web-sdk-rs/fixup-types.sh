#!/bin/sh
cp pkg/tinycloud_web_sdk_rs.d.ts dist/ && ( echo '
var fs = require("fs");
const re = new RegExp("../pkg", "g");
const dist = fs.opendirSync("./dist");
while (true) {
  const entry = dist.readSync();
  if (!entry) {
    break;
  }
  if (entry.isFile() && entry.name.endsWith(".d.ts")) {
    let filepath = "./dist/" + entry.name;
    let file = fs.readFileSync(filepath, { encoding: "utf8" });
    let replaced = file.replace(re, ".");
    fs.writeFileSync(filepath, replaced);
  }
}' | node )

