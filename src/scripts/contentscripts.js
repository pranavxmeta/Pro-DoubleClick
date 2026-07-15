
(() => {
    const SINGLE_CLICK_DURATION = 270;
    const DEFAULT_SETTING = 'background';
    const EXCLUDED_PROTOCOLS = ['javascript:', 'mailto:', 'tel:', 'data:', 'file:'];

    // ---------- Global State ----------
    let singleClickTimer = null;
    let lastTargetLink = null;
    let isInternalSimulation = false; // Prevents infinite loop during simulated clicks
    let defaultSetting = DEFAULT_SETTING;
    let sitePreferences = {};
    let excludedSites = {};
    const hostname = (window.location.hostname || '').replace(/^www\./, '');

    const isContextValid = () =>
        typeof chrome !== 'undefined' && !!chrome.runtime?.id;

    const loadSettings = () => {
        if (!isContextValid() || !chrome.storage?.sync) return;

        chrome.storage.sync.get(['defaultSetting', 'sitePreferences', 'excludedSites'], (data) => {
            if (chrome.runtime.lastError) return;
            defaultSetting = data.defaultSetting || DEFAULT_SETTING;
            sitePreferences = data.sitePreferences || {};
            excludedSites = data.excludedSites || {};
        });
    };

    const evaluateTargetTabAction = () => {
        const setting = sitePreferences[hostname] || defaultSetting;
        return setting === 'foreground';
    };

    const isValidAnchor = (node) =>
        (node instanceof HTMLAnchorElement && node.href) ||
        (node instanceof HTMLAreaElement && node.href);

    const getLinkFromTarget = (target) => {
        let node = target;
        while (node && node !== document.documentElement) {
            if (isValidAnchor(node)) return node;
            node = node.parentNode;
        }
        return null;
    };

    const isNestedInteractiveElement = (target, link) => {
        let node = target;
        while (node && node !== link) {
            const tagName = node.tagName?.toLowerCase();
            const role = node.getAttribute?.('role');
            if (['button', 'input', 'select', 'textarea'].includes(tagName) ||
                role === 'button' || role === 'link') {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    };

    const isJavaScriptComponent = (link) => {
        if (!link) return false;

        const UI_ATTRIBUTES = [
            'aria-haspopup',
            'aria-controls',
            'aria-expanded',
            'data-toggle',
            'data-target'
        ];

        return UI_ATTRIBUTES.some(attr => link.hasAttribute(attr));
    };

    const shouldInterceptLink = (link) => {
        if (!link || !link.href) return false;

        const protocol = link.protocol?.toLowerCase() ?? '';
        const hrefAttr = link.getAttribute('href') ?? '';
        const target = link.getAttribute('target') || '';

        if (EXCLUDED_PROTOCOLS.includes(protocol)) return false;
        if (hrefAttr === '#' || hrefAttr.startsWith('#')) return false;

        if (isJavaScriptComponent(link)) return false;

        return true;
    };

    const clearTrackingState = () => {
        if (singleClickTimer) {
            clearTimeout(singleClickTimer);
            singleClickTimer = null;
        }
        lastTargetLink = null;
    };

    // ---------- Core Logic ----------
    function handlePageInterceptions(e) {
        if (!isContextValid() || !hostname || excludedSites[hostname]) return;

        if (isInternalSimulation) return;

        if (!e.isTrusted || e.button !== 0 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;

        const clickableLink = getLinkFromTarget(e.target);
        if (!clickableLink || !shouldInterceptLink(clickableLink)) return;

        // Avoid breaking interactive elements inside links (buttons, inputs, etc.)
        if (isNestedInteractiveElement(e.target, clickableLink)) return;

        if (e.target.closest('nav')) return;

        // ----- Single Click Path -----
        if (e.detail === 1) {
            lastTargetLink = clickableLink;

            e.preventDefault();
            e.stopPropagation();

            singleClickTimer = setTimeout(() => {
                if (lastTargetLink && isContextValid()) {
                    isInternalSimulation = true;
                    lastTargetLink.click();
                    isInternalSimulation = false;

                }
                clearTrackingState();
            }, SINGLE_CLICK_DURATION);
        }

        // ----- Double Click Path -----
        if (e.detail === 2 && lastTargetLink === clickableLink) {
            e.preventDefault();
            e.stopPropagation();

            clearTimeout(singleClickTimer);

            const openInForeground = evaluateTargetTabAction();

            if (openInForeground) {
                window.open(clickableLink.href, '_blank');
            }

            else {

                if (hostname === 'reddit.com') {
                    chrome.runtime.sendMessage({
                        action: 'OPEN_NEW_TAB',
                        url: clickableLink.href,
                        active: false
                    });
                }
                else {
                    isInternalSimulation = true;

                    const backgroundClickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: 1,
                        ctrlKey: true,
                        metaKey: true,
                        shiftKey: false
                    });

                    clickableLink.dispatchEvent(backgroundClickEvent);

                    isInternalSimulation = false;
                }
            }

            clearTrackingState();
        }
    }

    loadSettings();

    if (isContextValid() && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') loadSettings();
        });
    }

    document.addEventListener('click', handlePageInterceptions, true);
})();