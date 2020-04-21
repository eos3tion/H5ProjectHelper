const cp = require("child_process");
const project = "@name@";
const path = "/data/projects/h5build/scripts/PakData.js";
let argv = process.argv;
let version = argv[2] || "";
if (version) {
    version += "/"
}
cp.fork(path, [JSON.stringify({
    project,
    version
})]);