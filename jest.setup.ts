import { log } from "./source/log";
log.error = log.warn = log.info = () => {};
