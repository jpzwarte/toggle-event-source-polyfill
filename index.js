import { apply, isSupported } from "./toggle-event-source.js";
if (!isSupported()) apply();
