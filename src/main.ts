import "./tokens.css";
import "./styles.css";
import "./pages.css";

import { mountMaker } from "./maker";
import { mountRoll, mountViewer } from "./viewer";

/**
 * Three routes, no router library:
 *   /           load a roll for someone
 *   /r/<slug>   open a roll someone sent you
 *   /demo       the seed / Sanity roll, for working on the strip itself
 */
const mount = document.getElementById("app");
const path = location.pathname.replace(/\/+$/, "") || "/";
const shared = path.match(/^\/r\/([a-z0-9]{6,16})$/);

if (mount) {
  if (shared) {
    void mountViewer(mount, shared[1]);
  } else if (path === "/demo") {
    void import("./content").then(({ roll }) => mountRoll(mount, roll));
  } else {
    mountMaker(mount);
  }
}
