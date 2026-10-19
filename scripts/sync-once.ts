// Manually run one sync pass (dev helper):  npm run sync
import { syncDue } from "../src/lib/sync";

syncDue()
  .then((r) => {
    console.log(r);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
