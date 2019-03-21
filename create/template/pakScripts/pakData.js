const cp = require("child_process");
const project = "@name@";
const path = "/data/projects/h5build/scripts/PakData.js";

cp.fork(path, [JSON.stringify({
    project
})]);