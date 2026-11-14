/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 * Modified 2026 by ProcessDraw: loads js/processdraw/ProcessDraw.js. See PROCESSDRAW.md.
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;
// ProcessDraw: loads the process engineering extension (js/processdraw/)
mxscript('js/processdraw/ProcessDraw.js', null, null, null, true);
