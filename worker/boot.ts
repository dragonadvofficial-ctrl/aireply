// Must be the first import of the worker: ESM evaluates imports in order.
process.env.RPLY_ROLE = "worker";
import "../src/lib/load-env";
